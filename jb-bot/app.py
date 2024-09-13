import argparse

from ChatBot import ChatBot

def main():
  parser = argparse.ArgumentParser(description="")

  parser.add_argument('-c', '--config', help='path to a JBrowse configuration file you would like to query.', required=True)
  parser.add_argument('-p', '--prompt', type=str, help='prompt query regarding your JBrowse config.json', required=False)
  parser.add_argument('-t', '--host', help='host URL for your JBrowse session', required=False)

  args = parser.parse_args()

  print('Initializing ChatBot...')

  if args.prompt:
    llm = ChatBot(args.config, args.host, False)
    non_interactive(llm, args.prompt)
  else:
    llm = ChatBot(args.config, args.host, True)
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