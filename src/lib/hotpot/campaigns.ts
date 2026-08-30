export interface CampaignSeed {
  id: string;
  campaign_name: string;
  syndicate: string;
  first_seen: string;
  threat_type: string;
  document: string;
}

/** Seed corpus written into the `scam_campaign_memory` collection on first boot. */
export const CAMPAIGN_SEEDS: CampaignSeed[] = [
  {
    id: "cmp-402",
    campaign_name: "National Power Syndicate #402",
    syndicate: "National Power Syndicate #402",
    first_seen: "2026-02-14",
    threat_type: "Fake Utility Disconnection / APK Trojan Fraud",
    document:
      "Dear customer your electricity power will be disconnect tonight 9:30 PM because previous month bill was not update. Please immediately contact electricity officer on personal mobile number and install the bijli update app apk to clear pending bill amount.",
  },
  {
    id: "cmp-118",
    campaign_name: "Jamtara KYC Cluster - Bank Re-verification",
    syndicate: "Jamtara KYC Cluster",
    first_seen: "2025-11-02",
    threat_type: "Fake KYC / Credential Harvesting",
    document:
      "Your bank account will be blocked today due to incomplete KYC. Update your PAN and Aadhaar details on the online portal link immediately or account will be closed. Share the OTP received for verification with the bank officer.",
  },
  {
    id: "cmp-G19",
    campaign_name: "Telegram Task Mill G-19",
    syndicate: "Telegram Task Mill G-19",
    first_seen: "2025-08-21",
    threat_type: "Prepaid Task / Investment Job Fraud",
    document:
      "Hello, part time job offer. Join our telegram group and complete simple like and subscribe tasks, daily income 3000 rupees. First three tasks free, after that prepaid merchant task requires small deposit which is refundable with commission of 30 percent.",
  },
  {
    id: "cmp-CCR",
    campaign_name: "Courier Clearance Ring (TRAI Parcel)",
    syndicate: "Courier Clearance Ring",
    first_seen: "2025-12-09",
    threat_type: "Impersonated Regulator / Digital Arrest",
    document:
      "This is TRAI department. A parcel in your name was seized by customs containing illegal narcotic items. Your mobile number will be disconnected within 2 hours and police FIR is registered. Press 9 to connect with cyber cell officer for verification and clearance fee.",
  },
  {
    id: "cmp-RAT",
    campaign_name: "Remote Access Fraud Kit",
    syndicate: "Remote Access Fraud Kit",
    first_seen: "2025-06-30",
    threat_type: "Remote Access Takeover",
    document:
      "Sir for refund processing please install anydesk or quicksupport screen share application and tell me the 9 digit code shown on screen so our team can process the refund into your account. Do not disconnect the call while transaction is running.",
  },
  {
    id: "cmp-UPIC",
    campaign_name: "UPI Collect Reversal Scam",
    syndicate: "UPI Mule Network",
    first_seen: "2026-01-18",
    threat_type: "UPI Collect Request Fraud",
    document:
      "I have accidentally sent money to your UPI id. Please accept the collect request and enter your UPI PIN to return the amount back. Scan this QR code to receive the refund into your account immediately.",
  },
  {
    id: "cmp-LEGIT",
    campaign_name: "Benign Logistics Notification (negative control)",
    syndicate: "-",
    first_seen: "2025-01-01",
    threat_type: "Legitimate Delivery Notification",
    document:
      "Your order id 402-8871 is out for delivery and scheduled for delivery today between 4 PM and 7 PM. Track your order in the app. No payment is required at the door for prepaid orders. We will never ask for your OTP over a phone call.",
  },
];

export const PRESET_SCENARIOS: { label: string; text: string }[] = [
  {
    label: "Electricity Disconnection",
    text: "Dear Consumer, your electricity power will be disconnect tonight at 9:30 PM from electricity office because your previous month bill was not update. Please immediately contact our electricity officer 9821143307. To pay pending amount Rs 8,420 install our app http://update-bijli.xyz/app.apk or pay to bijli.pay@ybl. - BSES",
  },
  {
    label: "Telegram Job Task",
    text: "Hello! I am HR Priya from Amazon marketing team. Part time job offer, daily income 3000-6000. Just like and subscribe simple tasks on our Telegram group t.me/joinearntask. First 3 tasks free, then prepaid merchant task of Rs 1000 refundable with commission of 30%. Send your payment to taskbonus@paytm and check earnings on task-rewards.buzz",
  },
  {
    label: "Fake KYC",
    text: "URGENT: Dear customer, your bank account will be blocked today due to incomplete KYC. Update your PAN card details now at https://kyc-sbi-online.top/verify or your account will be closed. Your OTP is 448210, share it with our verification officer on 9012233445 to complete re-KYC. Avl bal Rs 1,24,300 will be frozen.",
  },
  {
    label: "TRAI Parcel Scam",
    text: "This is TRAI Department of Telecom. A parcel booked in your name has been seized by Mumbai customs containing illegal narcotic items. Your mobile number 9876543210 will be disconnected within 2 hours and an FIR has been registered against you. Verify at trai-parcel-verify.icu and pay clearance fee to parcel.clear@upi to avoid arrest. Press 9 to speak with cyber cell officer.",
  },
  {
    label: "Legitimate Delivery",
    text: "Your order id 402-8871291 is out for delivery and scheduled for delivery today between 4 PM and 7 PM by delivery partner Rahul. Track your order in the app. No payment is required at the door for prepaid orders. We will never ask for your OTP over a phone call.",
  },
];
