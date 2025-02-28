const TelegramBot = require('node-telegram-bot-api');
const { OpenAI } = require('openai');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const token = '';
const openaiApiKey = '';

const bot = new TelegramBot(token, { polling: true });
const openai = new OpenAI({ apiKey: openaiApiKey });


const technicalSkills = [
  'JavaScript', 'Python', 'Java', 'C#', 'SQL', 'HTML', 'CSS', 'React', 'Node.js',
  'Docker', 'Kubernetes', 'AWS', 'Azure', 'Machine Learning', 'Artificial Intelligence',
  'DevOps', 'Git', 'Linux', 'Agile', 'Android', 'iOS', 'Swift', 'PHP', 'Ruby', 'C++', 'C',
  'Angular', 'UI/UX', 'Problem-Solving', 'Teamwork', 'Data analysis',
];


function extractSkills(text) {
  return technicalSkills.filter(skill => text.toLowerCase().includes(skill.toLowerCase()));
}

function splitMessage(message, maxLength = 4096) {
  const messages = [];
  while (message.length > maxLength) {
    const splitPoint = message.lastIndexOf('\n', maxLength);
    messages.push(message.slice(0, splitPoint));
    message = message.slice(splitPoint);
  }
  messages.push(message);
  return messages;
}


async function generateInterviewQuestionsAI(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating questions:', error);
    return 'Sorry, there was an error generating interview questions.';
  }
}


function calculateATSSCore(text) {
  const score = Math.floor(Math.random() * 51) + 50;
  return `Your ATS Score is: ${score}/100. Improve your resume by including keywords like ${technicalSkills.slice(0, 5).join(', ')}.`;
}


bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Check ATS Score', callback_data: 'ats_score' }],
        [{ text: 'Generate Questions from Resume', callback_data: 'generate_from_resume' }],
        [{ text: 'General Interview Questions', callback_data: 'general_questions' }],
        [{ text: 'Help', callback_data: 'help' }],
      ],
    },
  };

  bot.sendMessage(chatId, 'Choose an option:', options);
});


bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  if (action === 'ats_score') {
    bot.sendMessage(chatId, 'Please upload your resume (PDF) to calculate the ATS Score.');
  } else if (action === 'generate_from_resume') {
    bot.sendMessage(chatId, 'Please upload your resume (PDF) to extract keywords and generate interview questions.');
  } else if (action === 'general_questions') {
    bot.sendMessage(chatId, 'Generating general interview questions... Please wait.');
    const prompt = 'Generate a list of general interview questions for software engineers.';
    const questions = await generateInterviewQuestionsAI(prompt);
    const chunks = splitMessage(questions);
    chunks.forEach(chunk => bot.sendMessage(chatId, chunk));
  } else if (action === 'help') {
    bot.sendMessage(chatId, 'Upload a resume to:\n1. Check ATS Score\n2. Generate questions based on resume keywords.\n3. Get general interview questions.');
  }
});

bot.on('document', async (msg) => {
  const chatId = msg.chat.id;

  const fileId = msg.document.file_id;
  const filePath = await bot.downloadFile(fileId, './downloads');
  const fullPath = path.resolve(filePath);

  if (!fullPath.endsWith('.pdf')) {
    bot.sendMessage(chatId, 'Only PDF documents are supported.');
    return;
  }

  try {
    const data = fs.readFileSync(fullPath);
    const result = await pdfParse(data);
    const text = result.text;

    const skills = extractSkills(text);

    bot.sendMessage(chatId, 'Choose an action for your uploaded resume:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Check ATS Score', callback_data: `ats_${chatId}` }],
          [{ text: 'Generate Questions from Resume', callback_data: `questions_${chatId}` }],
        ],
      },
    });

    bot.on('callback_query', async (query) => {
      if (query.data === `ats_${chatId}`) {
        const atsScore = calculateATSSCore(text);
        bot.sendMessage(chatId, atsScore);
      } else if (query.data === `questions_${chatId}`) {
        if (skills.length > 0) {
          bot.sendMessage(chatId, `Skills found: ${skills.join(', ')}. Generating questions...`);
          const prompt = `Generate interview questions for the following skills: ${skills.join(', ')}`;
          const questions = await generateInterviewQuestionsAI(prompt);
          const chunks = splitMessage(questions);
          chunks.forEach(chunk => bot.sendMessage(chatId, chunk));
        } else {
          bot.sendMessage(chatId, 'No technical skills found in your resume.');
        }
      }
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    bot.sendMessage(chatId, 'There was an error processing your PDF file.');
  }
});

bot.on('message', (msg) => {
  if (!msg.document) {
    bot.sendMessage(msg.chat.id, 'Use /start to see available options.');
  }
});
