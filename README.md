# jbrowse-config-assistant-bot

A tool for querying your JBrowse configuration file.

## Installation

### Prerequisites

### Installation steps

## Usage

### Web Interface

```
poetry shell
flask --app jb-bot/util.py run
```

**Note**: It takes a few minutes for the bot to spin up

### CLI

#### Interactively

```
poetry run python jb-bot/app.py -c my-config-directory
```

#### Non-interactively

```
poetry run python jb-bot/app.py -p "What tracks do you have that show epigenetic modifications?" -c my-config-directory
```

## Options

```
-c -config : directory to your JBrowse configuration file.
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
