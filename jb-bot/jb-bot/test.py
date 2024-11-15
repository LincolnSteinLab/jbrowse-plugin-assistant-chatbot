import asyncio
from operator import itemgetter
from datetime import datetime
from typing import List, Optional, Sequence, Tuple, Union

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder, PromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langgraph.checkpoint.memory import MemorySaver
from langchain_community.document_loaders import JSONLoader, WebBaseLoader
from langchain_community.document_loaders.merge import MergedDataLoader
from langchain_community.vectorstores import Chroma

from langchain.schema.document import Document
from langchain.schema.language_model import BaseLanguageModel
from langchain.schema.messages import AIMessage, HumanMessage
from langchain.schema.retriever import BaseRetriever
from langchain.schema.output_parser import StrOutputParser
from langchain.schema.runnable import (
    ConfigurableField,
    Runnable,
    RunnableBranch,
    RunnableLambda,
    RunnableMap,
)

from langserve import add_routes
from langsmith import Client

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from uuid import UUID

RESPONSE_TEMPLATE = """\
You are an expert researcher and writer, tasked with answering any question.

Generate a comprehensive and informative, yet concise answer of 250 words or less for the \
given question based solely on the provided search results (URL and content). You must \
only use information from the provided search results. Use an unbiased and \
journalistic tone. Combine search results together into a coherent answer. Do not \
repeat text. Cite search results using [${{number}}] notation. Only cite the most \
relevant results that answer the question accurately. Place these citations at the end \
of the sentence or paragraph that reference them - do not put them all at the end. If \
different results refer to different entities within the same name, write separate \
answers for each entity. If you want to cite multiple results for the same sentence, \
format it as `[${{number1}}] [${{number2}}]`. However, you should NEVER do this with the \
same number - if you want to cite `number1` multiple times for a sentence, only do \
`[${{number1}}]` not `[${{number1}}] [${{number1}}]`

You should use bullet points in your answer for readability. Put citations where they apply \
rather than putting them all at the end.

If there is nothing in the context relevant to the question at hand, just say "Hmm, \
I'm not sure." Don't try to make up an answer.

Anything between the following `context` html blocks is retrieved from a knowledge \
bank, not part of the conversation with the user.

<context>
    {context}
<context/>

REMEMBER: If there is no relevant information within the context, just say "Hmm, I'm \
not sure." Don't try to make up an answer. Anything between the preceding 'context' \
html blocks is retrieved from a knowledge bank, not part of the conversation with the \
user. The current date is {current_date}.
"""

REPHRASE_TEMPLATE = """\
Given the following conversation and a follow up question, rephrase the follow up \
question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone Question:"""

class ChatRequest(BaseModel):
    question: str
    chat_history: List[Tuple[str, str]] = Field(
        ...,
        extra={"widget": {"type": "chat", "input": "question", "output": "answer"}},
    )

def serialize_history(request: ChatRequest):
    chat_history = request.get("chat_history", [])
    converted_chat_history = []
    for message in chat_history:
        if message[0] == "human":
            converted_chat_history.append(HumanMessage(content=message[1]))
        elif message[0] == "ai":
            converted_chat_history.append(AIMessage(content=message[1]))
    return converted_chat_history


def format_docs(docs: Sequence[Document]) -> str:
    formatted_docs = []
    for i, doc in enumerate(docs):
        doc_string = f"<doc id='{i}'>{doc.page_content}</doc>"
        formatted_docs.append(doc_string)
    return "\n".join(formatted_docs)

def create_retriever_chain(
    llm: BaseLanguageModel, retriever: BaseRetriever
) -> Runnable:
    CONDENSE_QUESTION_PROMPT = PromptTemplate.from_template(REPHRASE_TEMPLATE)
    condense_question_chain = (
        CONDENSE_QUESTION_PROMPT | llm | StrOutputParser()
    ).with_config(
        run_name="CondenseQuestion",
    )
    conversation_chain = condense_question_chain | retriever
    return RunnableBranch(
        (
            RunnableLambda(lambda x: bool(x.get("chat_history"))).with_config(
                run_name="HasChatHistoryCheck"
            ),
            conversation_chain.with_config(run_name="RetrievalChainWithHistory"),
        ),
        (
            RunnableLambda(itemgetter("question")).with_config(
                run_name="Itemgetter:question"
            )
            | retriever
        ).with_config(run_name="RetrievalChainWithNoHistory"),
    ).with_config(run_name="RouteDependingOnChatHistory")

def create_chain(
    llm: BaseLanguageModel,
    retriever: BaseRetriever,
) -> Runnable:
    retriever_chain = create_retriever_chain(llm, retriever) | RunnableLambda(
        format_docs
    ).with_config(run_name="FormatDocumentChunks")
    _context = RunnableMap(
        {
            "context": retriever_chain.with_config(run_name="RetrievalChain"),
            "question": RunnableLambda(itemgetter("question")).with_config(
                run_name="Itemgetter:question"
            ),
            "chat_history": RunnableLambda(itemgetter("chat_history")).with_config(
                run_name="Itemgetter:chat_history"
            ),
        }
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", RESPONSE_TEMPLATE),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ]
    ).partial(current_date=datetime.now().isoformat())

    response_synthesizer = (prompt | llm | StrOutputParser()).with_config(
        run_name="GenerateResponse",
    )
    return (
        {
            "question": RunnableLambda(itemgetter("question")).with_config(
                run_name="Itemgetter:question"
            ),
            "chat_history": RunnableLambda(serialize_history).with_config(
                run_name="SerializeHistory"
            ),
        }
        | _context
        | response_synthesizer
    )

client = Client()

# set up FastAPI
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# configuration
load_dotenv()

class Settings(BaseSettings):
    SettingsConfigDict(env_file=".env")

settings = Settings()

# set up llm
callbacks = [StreamingStdOutCallbackHandler()]
embedding = OpenAIEmbeddings()
tracks_loader = JSONLoader(file_path='./test_data/config_demo.json', jq_schema=".tracks[]", text_content=False)

jbrowse_loader = WebBaseLoader(web_paths=['https://jbrowse.org/jb2/docs/'])

merged_docs = MergedDataLoader([tracks_loader, jbrowse_loader]).load()

llm = ChatOpenAI(
        temperature=0.0,
        streaming=True,
        callbacks=callbacks,
        model="gpt-4o-mini",
    )

vector_store = Chroma.from_documents(documents=merged_docs, embedding=embedding)

retriever = vector_store.as_retriever()

memory = MemorySaver()

chain = create_chain(llm, retriever)

add_routes(app, chain, path="/chat", input_type=ChatRequest, config_keys=["configurable"])

class SendFeedbackBody(BaseModel):
    run_id: UUID
    key: str = "user_score"

    score: Union[float, int, bool, None] = None
    feedback_id: Optional[UUID] = None
    comment: Optional[str] = None


@app.post("/feedback")
async def send_feedback(body: SendFeedbackBody):
    client.create_feedback(
        body.run_id,
        body.key,
        score=body.score,
        comment=body.comment,
        feedback_id=body.feedback_id,
    )
    return {"result": "posted feedback successfully", "code": 200}


class UpdateFeedbackBody(BaseModel):
    feedback_id: UUID
    score: Union[float, int, bool, None] = None
    comment: Optional[str] = None


@app.patch("/feedback")
async def update_feedback(body: UpdateFeedbackBody):
    feedback_id = body.feedback_id
    if feedback_id is None:
        return {
            "result": "No feedback ID provided",
            "code": 400,
        }
    client.update_feedback(
        feedback_id,
        score=body.score,
        comment=body.comment,
    )
    return {"result": "patched feedback successfully", "code": 200}


# TODO: Update when async API is available
async def _arun(func, *args, **kwargs):
    return await asyncio.get_running_loop().run_in_executor(None, func, *args, **kwargs)


async def aget_trace_url(run_id: str) -> str:
    for i in range(5):
        try:
            await _arun(client.read_run, run_id)
            break
        except langsmith.utils.LangSmithError:
            await asyncio.sleep(1**i)

    if await _arun(client.run_is_shared, run_id):
        return await _arun(client.read_run_shared_link, run_id)
    return await _arun(client.share_run, run_id)


class GetTraceBody(BaseModel):
    run_id: UUID

@app.post("/get_trace")
async def get_trace(body: GetTraceBody):
    run_id = body.run_id
    if run_id is None:
        return {
            "result": "No LangSmith run ID provided",
            "code": 400,
        }
    return await aget_trace_url(str(run_id))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)
# from typing import Annotated, Any, Sequence, TypedDict, Literal
# from langchain_core.callbacks.base import Callbacks
# from langchain_core.messages import HumanMessage, AIMessage, BaseMessage, AIMessageChunk
# from langchain_core.runnables import RunnableConfig
# from langgraph.graph.message import add_messages
# from langgraph.graph.state import CompiledStateGraph, StateGraph, END, START
# from langchain_core.language_models import LanguageModelLike
# from langchain_core.retrievers import RetrieverLike
# from langchain.chains.history_aware_retriever import create_history_aware_retriever
# from langchain.chains.combine_documents import create_stuff_documents_chain
# from langchain.chains.retrieval import create_retrieval_chain
# from langgraph.prebuilt import ToolNode
# from langchain_core.tools import tool

# CXT_PROMPT="""
#     Given a chat history and the latest user question which might reference context in the chat history,
#     formulate a standalone question which can be understood without the chat history.
#     Do NOT answer the question, just reformulate it if needed and otherwise return it as is.
# """

# contextualize_q_prompt = ChatPromptTemplate.from_messages(
#     [
#         ("system", f'{CXT_PROMPT}'),
#         MessagesPlaceholder("chat_history"),
#         ("human", "{input}"),
#     ]
# )

# SYS_PROMPT = """
#             You are an expert in biological processes and an assistant for answering questions regarding JBrowse 2,
#             OR a user's JBrowse 2 configuration file. **No matter the question, you must provide a clear, accurate,
#             and complete response to the question.** Do the following to properly answer their question:

#             Determine whether the user is asking (A) about their specific configuration file or related biological
#             processes, or if they are asking (B) a general question about JBrowse 2 usage and specification.

#             A. If the user is asking about their configuration file or related biological processes,
#             answer using the following steps:
#                 1. Using your knowledge about the user's configuration file contents, and the biological processes
#                 that specifically relate to the contents, answer their question clearly, accurately, and completely.
#                 2. Explain why you made your conclusions. Do not make claims about the biological significance of
#                 the user's data.
#                 3. If, and only if, the user references TRACKS in their configuration file, AND you are able to provide
#                 an accurate answer, you should produce for them a link to their JBrowse 2 session. IF this makes sense
#                 with the context of their question to do, use the following steps to construct a link:
#                     i. If the user has explicitly stated a location or gene, proceed to (ii) using that as your {{loc}}.
#                     Otherwise, Using your breadth of knowledge, determine a gene id (you will know this as {{loc}}) 
#                     that is commonly related to the assembly of the track that you found that helps the user with their question.
#                     Explain to the user your choice. For example, you might choose TP53 as a common gene in cancer research.
#                     ii. By the user's query, determine the view type they'd like to see. If the user asks to see synteny, use
#                     LinearSyntenyView, otherwise use LinearGenomeView. This is your {{view_type}}.
#                     iii. Generate a {{session_spec}} for the user that fulfills their needs. Use the following to generate a
#                     session spec for LinearSyntenyView; skip this if the {{view_type}} is LinearGenomeView:
#                     ```
#                     {{
#                         "views": [
#                             {{
#                             "type": "{{view_type}}",
#                             "tracks": [{{track_ids}}], //  (self vs self alignment)
#                             "views": [
#                                 {{ "loc": "{{loc}}", "assembly": "{{assembly_1}}" }},
#                                 {{ "loc": "{{loc}}", "assembly": "{{assembly_2}}" }}
#                             ]
#                             }}
#                         ]
#                     }}
#                     ```
#                     Use the following to generate a session spec for LinearGenomeView:
#                     ```
#                        {{
#                             "views": [
#                                 {{
#                                 "assembly": "{{assembly}}",
#                                 "loc": "{{loc}}",
#                                 "type": "{{view_type}}",
#                                 "tracks": [
#                                     {{track_ids}}
#                                 ]
#                                 }}
#                             ]
#                         }}
#                     ```

#                     For either session spec, here are your parameters:
#                         {{assembly}} is to be replaced with the assemblyName associated with the tracks of interest; note that if the user has
#                         asked for synteny, they might have {{assembly_1}} and {{assembly_2}} that could be parsed out of their query or their tracks
#                         {{track_ids}} is to be replaced with a comma delimited list of the trackId's relating to the
#                         tracks resulting from thier query, each surrounded by double quotes "
#                         {{view_type}} should default to LinearGenomeView, but can be one of the following depending on what the
#                         user has asked of you: LinearGenomeView, CircularView, DotplotView, SpreadsheetView, SVInspectorView, or LinearSyntenyView
#                         {{loc}} to the be replaced with the loc determined either from the user or your own determination in the step prior
#                     iv. Produce a URL that follows the following pattern:

#                         ```{{host}}?config={{config}}&session=spec-{{session_spec}}```

#                         where {{host}} to the be replaced with the host variable, {{config}} is to be replaced with the
#                         config variable
#                         {{session_spec}} is to be replaced with the session spec you crafted in the step prior

#                         Before presenting the link to the user, ensure all special characters are encoded.
#                         Print the encoded URL plainly so the user can see where it is linking to. Also provide the user with a hyperlink.

#             B. If the user is asking a general question about JBrowse 2 usage and specification, answer using the following steps:
#                 1. Using your knowledge about the JBrowse documentation, find the answer to the user's question within the documentation.
#                 2. You MUST QUOTE the documentation in your response. Your response must be supported by text found within the JBrowse documentation.
#                 3. Provide a hyperlink to the documentation in your response. Print the URL plainly so the user can see where it is linking to.
#         """

# qa_prompt = ChatPromptTemplate.from_messages(
#             [
#                 ("system", f'{SYS_PROMPT}'),
#                 MessagesPlaceholder("chat_history"),
#                 ("user", "Context: {context}\nQuestion: {input}")
#             ]
#         )

# CONFIG = { "configurable": { "thread_id": "abc123" } }

# @tool
# def search(query: str):
#     """Call to surf the web"""
#     return ["Cloudy with a chance of hail"]

# class RAGChainWithMemory:
#     def __init__(
#         self, memory, retriever: RetrieverLike, llm: LanguageModelLike
#     ):
#         """
#         Initializes the Retrieval-Augmented Generation (RAG) chain with memory.
#         """
#         self.memory = memory
#         self.llm = llm

#         # Create the history-aware retriever
#         self.history_aware_retriever = create_history_aware_retriever(
#             llm=self.llm,
#             retriever=retriever,
#             prompt=contextualize_q_prompt,
#         )

#         # Create the documents chain
#         self.question_answer_chain = create_stuff_documents_chain(
#             llm=self.llm,
#             prompt=qa_prompt,
#         )

#         # Create the retrieval chain
#         self.rag_chain = create_retrieval_chain(
#             retriever=self.history_aware_retriever,
#             combine_docs_chain=self.question_answer_chain,
#         )

#         tools = [search]
#         llm.bind_tools(tools)

# class ChatResponse(TypedDict):
#     chat_history: Annotated[Sequence[BaseMessage], add_messages]
#     context: str
#     answer: str
# class ChatState(ChatResponse):
#     input: str
# class RAGGraphWithMemory(RAGChainWithMemory):
#     def __init__(self, **chain_kwargs):
#         super().__init__(**chain_kwargs)
#         tools = [search]
#         tool_node = ToolNode(tools)
#         # Single-node graph (for now)
#         graph: StateGraph = StateGraph(ChatState)
#         graph.add_node("model", self.call_model)
#         graph.add_node("tools", tool_node)
#         graph.set_entry_point("model")
#         graph.set_finish_point("model")
#         graph.add_conditional_edges("model", self.should_continue, ["tools", END])
#         graph.add_edge("tools", "model")
#         memory = MemorySaver()
#         self.graph: CompiledStateGraph = graph.compile(checkpointer=memory)
#     async def call_model(
#         self, state: ChatState, config: RunnableConfig
#     ) -> ChatResponse:
#         response = await self.rag_chain.ainvoke(state, config)
#         return {
#             "chat_history": [
#                 HumanMessage(state["input"]),
#                 AIMessage(response["answer"]),
#             ],
#             "context": response["context"],
#             "answer": response["answer"],
#         }
#     def should_continue(self, state: StateGraph):
#         messages = state["chat_history"]
#         last_message = messages[-1]
#         # If there is no function call, then we finish
#         if not last_message.tool_calls:
#             return END
#         # Otherwise if there is, we continue
#         else:
#             return "tools"
#     async def ainvoke(
#         self, user_input: str, callbacks: Callbacks,
#         configurable: dict[str, Any]
#     ) -> str:
#         response: dict[str, Any] = await self.graph.ainvoke(
#             {"input": user_input},
#             config = RunnableConfig(
#                 callbacks = callbacks,
#                 configurable = configurable,
#             )
#         )
#         return response["answer"]

# async def run():

#     callbacks = [StreamingStdOutCallbackHandler()]
#     embedding = OpenAIEmbeddings()
#     tracks_loader = JSONLoader(file_path='./test_data/config_demo.json', jq_schema=".tracks[]", text_content=False)

#     jbrowse_loader = WebBaseLoader(web_paths=['https://jbrowse.org/jb2/docs/'])

#     merged_docs = MergedDataLoader([tracks_loader, jbrowse_loader]).load()

#     llm = ChatOpenAI(
#             temperature=0.0,
#             streaming=True,
#             callbacks=callbacks,
#             model="gpt-4o-mini",
#         )
    
#     vector_store = Chroma.from_documents(documents=merged_docs, embedding=embedding)

#     retriever = vector_store.as_retriever()

#     memory = MemorySaver()

#     qa = RAGGraphWithMemory(
#         memory=memory,
#         retriever=retriever,
#         llm=llm
#     )

#     query = "I am studying breast cancer, what tracks would you recommend?"

#     first = True
#     async for msg, metadata in qa.graph.astream({"input": query}, stream_mode="messages", config=CONFIG):
#         # if msg.content and not isinstance(msg, HumanMessage):
#         #     print(msg.content, end="|", flush=True)

#         if isinstance(msg, AIMessageChunk):
#             if first:
#                 gathered = msg
#                 first = False
#             else:
#                 gathered = gathered + msg

#             if msg.tool_call_chunks:
#                 print(gathered.tool_calls)

# loop = asyncio.get_event_loop()
# loop.run_until_complete(run())