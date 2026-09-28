// APP-2 — prints a fresh VAPID key pair for Web Push (RUNBOOKS §25).
// Run once, put the three lines in Vercel (Production + Preview) and never
// rotate lightly: every browser subscribed with the old public key stops
// receiving until it turns notifications on again.
import { generateVapidKeys } from "../src/lib/webPush";

const { publicKey, privateKey } = generateVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:notifiche@prevai.it");
