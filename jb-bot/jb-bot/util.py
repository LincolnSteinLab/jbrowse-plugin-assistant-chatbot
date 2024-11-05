"""
**NOTE**: The tool LangServe https://python.langchain.com/docs/langserve/ may be more appropriate for this component of the bot solution. The tool is currently built with Flask. As of v0.3 it is not compatibile with LangGraph.
"""

import os
from flask import request, jsonify
from dotenv import load_dotenv
from flask_cors import cross_origin
from flask import Flask

from .LangChainChatBot import ChatBot

app = Flask(__name__)

load_dotenv()

app.config['GOOGLE_API_KEY'] = os.environ.get('GOOGLE_API_KEY')
app.config['OPENAI_API_KEY'] = os.environ.get('OPENAI_API_KEY')
app.config['CONFIG'] = os.environ.get('CONFIG')
app.config['HOST'] = os.environ.get('HOST')

print('Initializing ChatBot...')
if (not app.config['OPENAI_API_KEY'] == ''):
  app.config['MODEL'] = 'openai'
  llm = ChatBot(app.config['CONFIG'], app.config['HOST'], 'openai', True)
elif (not app.config['GOOGLE_API_KEY'] == ''):
  app.config['MODEL'] = 'gemini'
  llm = ChatBot(app.config['CONFIG'], app.config['HOST'], 'gemini', True)

@app.route('/')
def index():
  # TODO: add a log of each request sent
  return f'Chatbot is running!\nRunning {app.config['MODEL']} model\nUsing {app.config['CONFIG']} config\nHost found at: {app.config['HOST']}'

@app.route('/api/message', methods=['POST', 'OPTIONS'])
@cross_origin()
def message():
  data = request.get_json()
  return str(llm.run(data['message']['text'])).rstrip('\n')

if __name__ == '__main__':
  app.run()
