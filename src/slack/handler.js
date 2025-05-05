let cachedUsers = null;
let lastFetchedTime = 0;

const getUserList = async (client) => {
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;

  if (!cachedUsers || now - lastFetchedTime > FIVE_MINUTES) {
    console.log("Fetching fresh user list from Slack API--->");
    const result = await client.users.list();
    cachedUsers = result.members;
    lastFetchedTime = now;
  } else {
    console.log("Using cached user list.");
  }

  return cachedUsers;
};

const handleSlashCommand = (app) => {
  app.command("/approval-test", async ({ ack, body, client }) => {
    await ack();

    try {
      const users = await getUserList(client);

      const approverOptions = users
        .filter(
          (user) =>
            !user.is_bot && user.id !== body.user_id && user.id !== "USLACKBOT"
        )
        .map((user) => ({
          text: { type: "plain_text", text: user.real_name || user.name },
          value: user.id,
        }));

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: "modal",
          callback_id: "approval_modal",
          title: { type: "plain_text", text: "Request Approval" },
          submit: { type: "plain_text", text: "Submit" },
          blocks: [
            {
              type: "input",
              block_id: "approver_block",
              label: { type: "plain_text", text: "Select Approver" },
              element: {
                type: "static_select",
                action_id: "approver",
                options: approverOptions,
              },
            },
            {
              type: "input",
              block_id: "text_block",
              label: { type: "plain_text", text: "Approval Reason" },
              element: {
                type: "plain_text_input",
                action_id: "approval_text",
                multiline: true,
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error("Error in slash command handler:", error);
    }
  });
};

const handleApproval = (app) => {
  app.view("approval_modal", async ({ ack, view, body, client, logger }) => {
    try {
      await ack();

      const approver =
        view.state.values.approver_block.approver.selected_option.value;
      const reason = view.state.values.text_block.approval_text.value;
      const requester = body.user.id;

      //Send the message to the selected approver
      const result = await client.chat.postMessage({
        channel: approver,
        text: `:memo: You have a new approval request from <@${requester}>.`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🔔 Approval Request",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Requester:* <@${requester}>\n*Reason:*\n>${reason}`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Approve" },
                style: "primary",
                action_id: "approve_request",
                value: JSON.stringify({ requester, reason }),
              },
              {
                type: "button",
                text: { type: "plain_text", text: "Reject" },
                style: "danger",
                action_id: "reject_request",
                value: JSON.stringify({ requester, reason }),
              },
            ],
          },
        ],
      });

      console.log("Message sent---->", result);

      //open the confirmation modal for the user who submitted the request
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: "modal",
          callback_id: "confirmation_modal",
          title: {
            type: "plain_text",
            text: "Approval Request Sent",
          },
          close: {
            type: "plain_text",
            text: "Close",
          },
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `✅ Your approval request has been successfully submitted to <@${approver}>.\n\n*Reason:* ${reason}`,
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error("Error in modal handler:", error);
    }
  });
};

const handleAction = (app) => {
  app.action("approve_request", async ({ ack, body, client }) => {
    await ack();
    try {
      const { requester, reason } = JSON.parse(body.actions[0].value);
      console.log(`✅ Approving request for <@${requester}>`);

      //Send message to requester id request is approved
      await client.chat.postMessage({
        channel: requester,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "✅ Approved",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "🎉 *Great news!* One of your approval requests has been *approved!* ",
            },
          },
          {
            type: "divider",
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "👋 Here is a summary of your approval request:",
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: "*Status:*\nApproved",
              },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Description:*\n${reason}`,
            },
          },
        ],
      });

      //update the approver message
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: "✅ Request Approved",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "✅ Request Approved",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `You have *approved* the request from <@${requester}>.`,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: "*Status:*\nApproved",
              },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Description:*\n${reason}`,
            },
          },
        ],
      });
    } catch (error) {
      console.error("Error in approve_request handler:", error);
    }
  });

  app.action("reject_request", async ({ ack, body, client }) => {
    await ack();

    try {
      const { requester, reason } = JSON.parse(body.actions[0].value);

      //send message to requester if request has been rejected
      await client.chat.postMessage({
        channel: requester,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "❌ Rejected",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Unfortunately*, your approval request was *rejected.*",
            },
          },
          {
            type: "divider",
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "👋 Here is a summary of your request:",
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: "*Status:*\nRejected",
              },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Description:*\n${reason}`,
            },
          },
        ],
      });

      //Update the approver message view
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: "❌ Request Rejected",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "❌ Request Rejected",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `You have *rejected* the request from <@${requester}>.`,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: "*Status:*\nRejected",
              },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Description:*\n${reason}`,
            },
          },
        ],
      });
    } catch (error) {
      console.error("Error in Reject Request", error);
    }
  });
};

export { handleSlashCommand, handleApproval, handleAction };
