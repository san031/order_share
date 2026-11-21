// Nexconn SDK setup. initialize, custom types and handlers must run only once per page load.
import { NCEngine, ConnectionStatusHandler, MessageHandler } from "@nexconn/chat";

// Custom message types (shape taken from index.d.ts, not yet checked against docs)
export const CARD_TYPE = "app:card"; // content: { cardId, item, price, target }
export const JOIN_TYPE = "app:join"; // content: { cardId, qty }  (latest qty per user wins)

let started = false;
let onMessages = () => {};

export function initChat(handler) {
  onMessages = handler; // always point at the latest handler
  if (started) return;

  NCEngine.initialize({ appKey: import.meta.env.VITE_NEXCONN_APP_KEY });
  NCEngine.registerCustomMessages([
    { messageType: CARD_TYPE, isPersisted: true, isCounted: true },
    { messageType: JOIN_TYPE, isPersisted: true, isCounted: false },
  ]);

  NCEngine.addConnectionStatusHandler("app", new ConnectionStatusHandler({
    onConnectionStatusChanged({ status, code }) {
      console.log("status", status, code);
    },
  }));

  NCEngine.addMessageHandler("app", new MessageHandler({
    onMessageReceived({ messages }) {
      console.log("received", messages);
      onMessages(messages);
    },
  }));
  started = true;
}

export const connectChat = (token) => NCEngine.connect({ token });
export const disconnectChat = () => NCEngine.disconnect();
