
from typing import Sequence, Literal
from typing_extensions import Annotated, TypedDict

from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_community.document_loaders import JSONLoader, WebBaseLoader
from langchain_community.document_loaders.merge import MergedDataLoader
from langchain_community.vectorstores import Chroma
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage, AIMessageChunk
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from rich.console import Console
from rich.markdown import Markdown
class State(TypedDict):
    input: str
    chat_history: Annotated[Sequence[BaseMessage], add_messages]
    context: str
    answer: str

def mdprint(text):
  Console.print(Markdown(text))
class ChatBot:
    CXT_PROMPT="""
            Given a chat history and the latest user question which might reference context in the chat history,
            formulate a standalone question which can be understood without the chat history.
            Do NOT answer the question, just reformulate it if needed and otherwise return it as is.
        """
    SYS_PROMPT="""
            You are an expert in biological processes and an assistant for answering questions regarding JBrowse 2,
            OR a user's JBrowse 2 configuration file. **No matter the question, you must provide a clear, accurate,
            and complete response to the question.** Do the following to properly answer their question:

            Determine whether the user is asking (A) about their specific configuration file or related biological
            processes, or if they are asking (B) a general question about JBrowse 2 usage and specification.

            A. If the user is asking about their configuration file or related biological processes,
            answer using the following steps:
                1. Using your knowledge about the user's configuration file contents, and the biological processes
                that specifically relate to the contents, answer their question clearly, accurately, and completely.
                2. Explain why you made your conclusions. Do not make claims about the biological significance of
                the user's data.
                3. If, and only if, the user references TRACKS in their configuration file, AND you are able to provide
                an accurate answer, you should produce for them a link to their JBrowse 2 session. IF this makes sense
                with the context of their question to do, use the following steps to construct a link:
                    i. If the user has explicitly stated a location or gene, proceed to (ii) using that as your {{loc}}.
                    Otherwise, Using your breadth of knowledge, determine a gene id (you will know this as {{loc}}) 
                    that is commonly related to the assembly of the track that you found that helps the user with their question.
                    Explain to the user your choice. For example, you might choose TP53 as a common gene in cancer research.
                    ii. By the user's query, determine the view type they'd like to see. If the user asks to see synteny, use
                    LinearSyntenyView, otherwise use LinearGenomeView. This is your {{view_type}}.
                    iii. Generate a {{session_spec}} for the user that fulfills their needs. Use the following to generate a
                    session spec for LinearSyntenyView; skip this if the {{view_type}} is LinearGenomeView:
                    ```
                    {{
                        "views": [
                            {{
                            "type": "{{view_type}}",
                            "tracks": [{{track_ids}}], //  (self vs self alignment)
                            "views": [
                                {{ "loc": "{{loc}}", "assembly": "{{assembly_1}}" }},
                                {{ "loc": "{{loc}}", "assembly": "{{assembly_2}}" }}
                            ]
                            }}
                        ]
                    }}
                    ```
                    Use the following to generate a session spec for LinearGenomeView:
                    ```
                       {{
                            "views": [
                                {{
                                "assembly": "{{assembly}}",
                                "loc": "{{loc}}",
                                "type": "{{view_type}}",
                                "tracks": [
                                    {{track_ids}}
                                ]
                                }}
                            ]
                        }}
                    ```

                    For either session spec, here are your parameters:
                        {{assembly}} is to be replaced with the assemblyName associated with the tracks of interest; note that if the user has
                        asked for synteny, they might have {{assembly_1}} and {{assembly_2}} that could be parsed out of their query or their tracks
                        {{track_ids}} is to be replaced with a comma delimited list of the trackId's relating to the
                        tracks resulting from thier query, each surrounded by double quotes "
                        {{view_type}} should default to LinearGenomeView, but can be one of the following depending on what the
                        user has asked of you: LinearGenomeView, CircularView, DotplotView, SpreadsheetView, SVInspectorView, or LinearSyntenyView
                        {{loc}} to the be replaced with the loc determined either from the user or your own determination in the step prior
                    iv. Produce a URL that follows the following pattern:

                        ```{{host}}?config={{config}}&session=spec-{{session_spec}}```

                        where {{host}} to the be replaced with the host variable, {{config}} is to be replaced with the
                        config variable
                        {{session_spec}} is to be replaced with the session spec you crafted in the step prior

                        Before presenting the link to the user, ensure all special characters are encoded.
                        Print the encoded URL plainly so the user can see where it is linking to. Also provide the user with a hyperlink.

            B. If the user is asking a general question about JBrowse 2 usage and specification, answer using the following steps:
                1. Using your knowledge about the JBrowse documentation, find the answer to the user's question within the documentation.
                2. You MUST QUOTE the documentation in your response. Your response must be supported by text found within the JBrowse documentation.
                3. Provide a hyperlink to the documentation in your response. Print the URL plainly so the user can see where it is linking to.
        """

    CONFIG = { "configurable": { "thread_id": "abc123" } }
    def __init__(self, config, host, model, is_interactive):
        self.config = config
        self.host = host
        self.model = model
        self.is_interactive = is_interactive

        self.workflow = StateGraph(state_schema=State)
        self.memory = MemorySaver()
        self.app = None

        self.engine = self.setup(config, model)

    @tool
    def query(self, query: str):
        """Call query."""
        return [query if True else ""]

    def should_continue(self, state: State):
        messages = state["chat_history"]
        last_message = messages[-1]
        # If there is no function call, then we finish
        if not last_message.tool_calls:
            return END
        # Otherwise if there is, we continue
        else:
            return "tools"

    def setup(self, config, model):
        tracks_loader = JSONLoader(file_path=config, jq_schema=".tracks[]", text_content=False)

        jbrowse_loader = WebBaseLoader(web_paths=['https://jbrowse.org/jb2/docs/'])

        merged_docs = MergedDataLoader([tracks_loader, jbrowse_loader]).load()

        callbacks = [StreamingStdOutCallbackHandler()]

        if (model == 'gemini'):
            embedding = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
            llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.0, seed=45, max_tokens=None, timeout=None)
        if (model == 'openai'):
            embedding = OpenAIEmbeddings()
            llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.0, seed=45, max_tokens=None, timeout=None, callbacks=callbacks, streaming=True)
            # llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.0, seed=45, max_tokens=None, timeout=None)

        self.llm = llm
        vector_store = Chroma.from_documents(documents=merged_docs, embedding=embedding)

        retriever = vector_store.as_retriever()

        # ADD HISTORY
        contextualize_q_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", f'{self.CXT_PROMPT}'),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )
        history_aware_retriever = create_history_aware_retriever(
            llm, retriever, contextualize_q_prompt
        )

        # ADD CONVERSATIONAL CONFIG CHAIN
        answer_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", f'{self.SYS_PROMPT} {self.set_variables}'),
                MessagesPlaceholder("chat_history"),
                ("user", "Context: {context}\nQuestion: {input}")
            ]
        )
        docs_chain = create_stuff_documents_chain(self.llm, answer_prompt)

        rag_chain = create_retrieval_chain(history_aware_retriever, docs_chain)

        tools = [self.query]
        tool_node = ToolNode(tools)

        # LangGraph for history maintenence
        self.workflow.add_edge(START, "model")
        self.workflow.add_node("model", self.call_model)
        self.workflow.add_node("tools", tool_node)
        self.workflow.add_conditional_edges("model", self.should_continue, ["tools", END])
        self.workflow.add_edge("tools", "model")
        # init app
        self.app = self.workflow.compile(checkpointer=self.memory)

        return rag_chain

    async def call_model(self, state: State, config: RunnableConfig):
        response = await self.engine.ainvoke(state, config)
        return {
            "chat_history": [
                HumanMessage(state["input"]),
                AIMessage(response["answer"])
            ],
            "context": response["context"],
            "answer": response["answer"],
        }

    def set_variables(self):
        host = f'\nHOST={self.host}'
        config_name = f'\nCONFIG={self.config}'
        variables = f'\nUse these as variables: ' + host + config_name
        return variables
    
    def append_sys_prompt(self, query):
        return f'\n{self.SYS_PROMPT}' + '\nThe following is the user\'s query: ' + query

    def run(self, query):
        query = query + self.set_variables()
        return self.stream(query)

    async def stream(self, query):
        first = True
        async for msg in self.app.astream( { "input": query }, config=self.CONFIG, stream_mode="messages"):
            if isinstance(msg, AIMessageChunk):
                if first:
                    gathered = msg
                    first = False
                else:
                    gathered = gathered + msg

                if msg.tool_call_chunks:
                    mdprint(gathered.tool_calls)
                    # yield str(gathered.tool_calls)
                    yield gathered.tool_calls