require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const { nanoid } = require("nanoid");
const Groq = require("groq-sdk");

// ---------------- ENV ----------------
const PORT = process.env.PORT || 10000;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const groq = new Groq({ apiKey: GROQ_API_KEY });

// ---------------- EXPRESS ----------------
const app = express();
app.use(bodyParser.json());

// ---------------- SEND TEXT ----------------
async function sendText(to, body) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  try {
    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.log("SEND TEXT ERROR:", err.response?.data || err);
  }
}

// ---------------- ASK GROQ ----------------
async function askGroq(question, lang = "English") {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `
You are a study AI assistant.
Reply ONLY in JSON format:
{
  "short_answer": "",
  "detailed_answer": ""
}

Question: ${question}
Language: ${lang}
`,
        },
      ],
      temperature: 0.3,
    });

    let raw = completion.choices[0].message.content.trim();

    // Try JSON parse
    try {
      return JSON.parse(raw);
    } catch {
      return {
        short_answer: raw.slice(0, 200),
        detailed_answer: raw,
      };
    }
  } catch (error) {
    console.log("GROQ ERROR:", error);
    return {
      short_answer: "AI error",
      detailed_answer: "Please try again later.",
    };
  }
}

// ---------------- VERIFY WEBHOOK ----------------
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// ---------------- RECEIVE MESSAGE ----------------
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body || "";

    console.log("USER MESSAGE:", text);

    const ai = await askGroq(text);

    await sendText(from, `📌 Short: ${ai.short_answer}`);
    await sendText(from, ai.detailed_answer);

    res.sendStatus(200);
  } catch (e) {
    console.log("WEBHOOK ERROR:", e);
    res.sendStatus(200);
  }
});

// ---------------- HEALTH CHECK ----------------
app.get("/", (req, res) => {
  res.send("STUDY BOT AI RUNNING ✔ with GROQ");
});

// ---------------- START ----------------
app.listen(PORT, () => console.log("🚀 SERVER RUNNING ON PORT", PORT));
