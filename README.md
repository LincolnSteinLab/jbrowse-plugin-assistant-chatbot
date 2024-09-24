# jbrowse-config-assistant-bot

A tool for querying your JBrowse configuration file.

## Installation

### Prerequisites

### Installation steps

## Usage

### Web Interface

In `/jb-bot`:

```
poetry run flask —app jb-bot/util.py run
```

**Note**: It may take few minutes for the bot to spin up

Open another tab, in `/web-app`

```
yarn dev
```

### CLI

#### Interactively

```
poetry run python jb-bot/app.py
```

#### Non-interactively

```
poetry run python jb-bot/app.py -p "What tracks do you have that show epigenetic modifications?"
```

## Options

```
-c -config : directory to your JBrowse configuration file.
-h -help   : print this help message and exit.
-m -model  : specify the model you want to use, "openai" or "gemini"
-p -prompt : prompt query regarding your JBrowse config.json.
```

## Configuration

### Environment variables

- `GOOGLE_API_KEY`: API key to interface with [Google Gemini]().
- `OPENAI_API_KEY`: API key to interface with [OpenAI]().
- `CONFIG`: Path to configuration file(s) (may be remote location)
- `HOST`: the host URL of your JBrowse instance (used for generating dynamic links)

At least one language model specification is required.

Configure your environment variables with the `POETRY_` alias:

e.g.

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

## Future enhancements

- compatibility with custom models

## Acknowledgements

The author(s) of this project recognize the assistance and inspiration from the authors of [Reactome ChatBot](https://github.com/reactome/reactome_chatbot).
