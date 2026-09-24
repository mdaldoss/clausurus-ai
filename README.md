# SecureChat AI

built  a webapp which take inspiration of open webui. Like is similar to apertus ai I would like to have a chatbot where I can customise and choose which LLM to use.
The difference with any other LLM aggregator is that it will flag to the user which personal data he inserted and he will be shown to him, on a side box, that those sensitive data have been detected (like name, social security number, credit card, etc) and tell that those data have been anonymized before sending to the target LLM. 
To anonymized the data I would like you to come up with some regex or using the LLM Apertus (apertus.swiss).

Models are served through [OpenRouter](https://openrouter.ai), which fronts OpenAI, Anthropic, Google and other providers behind a single API.

## Development

You need Node.js — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
```

Create a `.env` file in the project root with your OpenRouter API key:

```
OPENROUTER_API_KEY=sk-or-v1-...
```

Then start the dev server:

```sh
npm run dev
```
