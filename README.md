# JBrowse Copilot / WebMCP Plugin

Agentic AI interfaces for JBrowse:
- AI chat in a sidebar widget.
- Exposing JBrowse functionality as WebMCP tools.

## Usage

### Software requirements

- [git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en/download/) (version 24)
- [JBrowse 2](https://github.com/gmod/jbrowse-components) (version 4.0 or
  greater)

## Getting started

### Setup

Run `npm install` to
install the necessary dependencies.

After this, run `npm run setup`. This configures your project,
and adds a build of JBrowse 2 that can be used to test your plugin during
development.

### Build

```console
$ npm run build
```

### Development

To develop against JBrowse Web:

- Start a development version of JBrowse Web (see
  [here](https://github.com/GMOD/jbrowse-components/blob/master/CONTRIBUTING.md))
- In this project, run `npm run start`
- Assuming JBrowse Web is being served on port 3000, navigate in your web
  browser to
  http://localhost:3000/?config=http://localhost:9000/jbrowse_config.json
- When you make changes to your plugin, it will automatically be re-built. You
  can then refresh JBrowse Web to see the changes.

### Testing

#### `npm run browse`

Launches your local JBrowse 2 build that is used for integration testing, with
your plugin already included in the configuration. Your plugin must also be
running (`npm run start`). Alternatively `npm run develop` will run both commands in parallel.
