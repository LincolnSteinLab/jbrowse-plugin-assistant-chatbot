import os
from flask import request, jsonify
from dotenv import load_dotenv
from flask_cors import cross_origin
from flask import Flask

from .ChatBot import ChatBot

app = Flask(__name__)

load_dotenv()

app.config['GOOGLE_API_KEY'] = os.environ.get('GOOGLE_API_KEY')
app.config['CONFIG'] = os.environ.get('CONFIG')
app.config['HOST'] = os.environ.get('HOST')

print('Initializing ChatBot...')
llm = ChatBot(app.config['CONFIG'], app.config['HOST'], True)

@app.route('/')
def index():
  print('Chatbot is running!')
  # maybe have some sort of log on this page to show requests ?
  return 'Chatbot is running!'

@app.route('/api/message', methods=['POST', 'OPTIONS'])
@cross_origin()
def message():
  data = request.get_json()
  return str(llm.run(data['message']['text'])).rstrip('\n')

if __name__ == '__main__':
  app.run()
