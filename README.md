# jb-bot

A tool for querying your JBrowse configuration file.

## Installation

### Prerequisites

### Installation steps

## Usage

### Interactively

```
poetry run python bin/jb-bot.py -c my-config.json
```

### Non-interactively

```
poetry run python bin/jb-bot.py -p "What tracks do you have that show epigenetic modifications?" -c my-config.json
```

## Options

```
-c -config : your JBrowse configuration file.
-h -help   : print this help message and exit.
-p -prompt : prompt query regarding your JBrowse config.json.
```

## Configuration

### Environment variables

- `GOOGLE_API_KEY`: API key to interface with [Google Gemini]() (required).

Configure your environment variables with the `POETRY_` alias:

```
export POETRY_GOOGLE_API_KEY=your_google_api_key
```

**OR** place the following in your `.env` file:

```
GOOGLE_API_KEY=your_google_api_key
```

and install the poetry plugin `poetry-plugin-dotenv`:

```
pipx inject poetry poetry-plugin-dotenv
```

## Web UI

## Acknowledgements

The author(s) of this project recognize the assistance and inspiration from the authors of [Reactome ChatBot](https://github.com/reactome/reactome_chatbot).
