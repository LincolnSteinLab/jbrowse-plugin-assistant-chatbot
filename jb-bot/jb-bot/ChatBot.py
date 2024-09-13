from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.embeddings.gemini import GeminiEmbedding
from llama_index.llms.gemini import Gemini

class ChatBot:
    SYS_PROMPT="""
        ## PURPOSE
            - you are a chatbot designed to assist JBrowse 2 users by answering
            questions about their configuration files. Your primary role is to
            provide clear, accurate, and concise responses based on the user's
            input and configuration file.
        ## BEHAVIOUR
            - use your bredth of knowledge to answer questions about the user's
            configuration file
            - consider the entire configuration file in your answer
            - if uncertain, inform the user that you lack sufficient information
            for a confident answer
            - focus exclusively on JBrowse 2-related queries and configuration files.
            For unrelated questions, explain your purpose succinctly.
            - when the user asks about interface usage, instruct them to type "q" and
            press "enter" to quit.
            - if a biological claim is made outside the configuration file, cite
            credible sources
            - do not repeat the same tracks if you are listing some out for the user
            - for question involving tracks, if the HOST variable exists, generate
            a JBrowse session URL using the following format:

            https://{host}?config={config}&assembly={assembly}&tracks={track_ids}

            where {host} is to be replaced with the HOST variable, {config} is to
            be replaced with the user's specified config file, {assembly} is to be
            replaced with the corresponding assembly found in "assemblyNames" with the
            track configuration json object, and {track_ids} is to be replaced with a
            comma delimited list of the track id's relating to the tracks resulting
            from their query. Make sure you encode any special characters with URL
            encoding.
        ## LIMITATIONS
            - only respond to questions related to JBrowse 2 or the user's provided
            configuration files.
    """
    def __init__(self, config, host, is_interactive):
        self.config = config
        self.host = host
        self.is_interactive = is_interactive
        self.engine = self.setup(config)

    def setup(self, config):
        documents = SimpleDirectoryReader(config).load_data()
        Settings.embed_model = GeminiEmbedding(model_name="models/embedding-001")
        Settings.llm = Gemini(model="models/gemini-1.5-flash", request_timeout=360.0)

        index = VectorStoreIndex.from_documents(documents)

        if self.is_interactive:
            memory = ChatMemoryBuffer.from_defaults(token_limit=5500)
            engine = index.as_chat_engine(chat_mode="context", memory=memory, system_prompt=self.SYS_PROMPT)
        else:
            engine = index.as_query_engine()

        return engine

    def set_variables(self, prompt):
        host = f'\nHOST={self.host}'
        # ADD ANY NEW VARIABLES THAT MIGHT BE USEFUL HERE
        variables = f'\nUse these as variables: ' + host
        return prompt + variables
    
    def append_sys_prompt(self, prompt):
        # TODO: may warrant a shorter and simpler sys prompt for the one-take queries
        return f'\n{self.SYS_PROMPT}' + '\nThe following is the user\'s query: ' + prompt

    def run(self, prompt):
        prompt = self.set_variables(prompt)
        if self.is_interactive:
            return self.engine.chat(prompt)
        else:
            prompt = self.append_sys_prompt(prompt)
            return self.engine.query(prompt)