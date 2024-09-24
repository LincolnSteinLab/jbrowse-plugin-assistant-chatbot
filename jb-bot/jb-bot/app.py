import os
import argparse
from dotenv import load_dotenv

from ChatBot import ChatBot

class Config:
  def __init__(self, model, config='./', host='host/jbrowse'):
    load_dotenv()

    self.model = model
    self.config_path = os.environ.get('CONFIG') if not '' else config
    self.host_path = os.environ.get('HOST') if not '' else host

  def set_config(self, config):
    self.config = config
  
  def set_host_path(self, host):
    self.host_path = host

def main():
  parser = argparse.ArgumentParser(description="")

  parser.add_argument('-p', '--prompt', type=str, help='prompt query regarding your JBrowse config.json', required=False)
  parser.add_argument('-m', '--model', type=str, help='specify the model you want to use, "openai" or "gemini"', required=False, default="gemini", choices=["openai", "gemini"])
  parser.add_argument('-c', '--config', help='path to a JBrowse configuration file you would like to query.', required=False)
  parser.add_argument('-t', '--host', help='host URL for your JBrowse session', required=False)

  args = parser.parse_args()

  config = Config(args.model)
  # prioritizes optional params
  if (args.config):
    config.set_config(args.config)
  if (args.host):
    config.set_config(args.host)

  print('Initializing ChatBot...')

  if args.prompt:
    llm = ChatBot(config.config_path, config.host_path, config.model, False)
    non_interactive(llm, args.prompt)
  else:
    llm = ChatBot(config.config_path, config.host_path, config.model, True)
    interactive(llm)

def non_interactive(llm, prompt):
  print(f'\nResponse: {llm.run(prompt)}')

def interactive(llm):
  open_chat = True
  print('This interactive JBrowse assistant can help you navigate your configuration file. Enter a query relating to your config.json, or enter "q" to exit.')
  while open_chat is True:
    query = input('\nQuery: ')
    if (query.lower().rstrip() == 'q'):
      open_chat = False
    else:
      print(f'\nResponse: \n\n{llm.run(query)}')

if __name__ == "__main__":
  main()