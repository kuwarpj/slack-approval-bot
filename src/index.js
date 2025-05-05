
import dotenv from "dotenv";
import { slackApp } from "./slack/slackApp.js";
import { handleAction, handleApproval, handleSlashCommand } from "./slack/handler.js";


dotenv.config();

const port = process.env.PORT || 3000;

handleSlashCommand(slackApp);
handleApproval(slackApp);
handleAction(slackApp)

slackApp.start(port).then(() => {
  console.log(`Slack app running on port ${port}`);
});
