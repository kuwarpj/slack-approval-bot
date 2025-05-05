import bolt from '@slack/bolt';
const { App, ExpressReceiver } = bolt;

import dotenv from 'dotenv';

dotenv.config();

export const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET
});


//Initializes slack app
export const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN, //token for authorize api calls
  receiver: expressReceiver
});
