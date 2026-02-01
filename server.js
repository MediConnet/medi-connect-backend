const express = require('express');
const dotenv = require('dotenv');
const { Resend } = require('resend');

dotenv.config();

const app = express();
const port = 5173;

const API_KEY = process.env.RESEND_API_KEY; 

if (!API_KEY) {
  console.error('Set RESEND_API_KEY in .env or environment');
  process.exit(1);
}

const resend = new Resend(API_KEY);

app.post('/send-email', async (req, res) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: ['kevincata2005@gmail.com'],
      subject: 'Hello World  prueba 2',
      html: '<strong>It works!</strong>',
    });

    if (error) {
      return res.status(500).json({ error });
    }

    return res.status(200).json({ data });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
