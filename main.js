import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('documentForm');
    const outputSections = [
        document.getElementById('section1'),
        document.getElementById('section2'),
        document.getElementById('section3'),
        document.getElementById('section4'),
        document.getElementById('section5')
    ];

    const model = new ChatGoogleGenerativeAI({
        modelName: 'gemini-1.5-pro',
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
        ],
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Form submitted'); // Debug log

        const title = document.getElementById('title').value;
        const databaseFile = document.getElementById('database').files[0];

        if (!databaseFile) {
            alert('Please upload a database file');
            return;
        }

        try {
            const database = await readFileContent(databaseFile);
            await runAssistant1(title, database);
        } catch (error) {
            console.error('Error processing form:', error);
            alert('An error occurred while generating the document. Please check the console for details.');
        }
    });

    async function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }

    async function runAssistant(prompt, outputSection) {
        try {
            console.log('Calling Gemini API with prompt:', prompt); // Debug log
            const response = await model.invoke(prompt);
            console.log('Received response:', response); // Debug log
            outputSection.innerHTML = response.content;
            return response.content;
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            outputSection.innerHTML = 'Error generating content';
            throw error;
        }
    }

    async function runAssistant1(title, database) {
        const prompt = `Write an introduction for a document titled '${title}' using information from this database: ${database}`;
        const response = await runAssistant(prompt, outputSections[0]);
        await runAssistant2(response, database);
    }

    async function runAssistant2(section1Content, database) {
        const prompt = `Based on the introduction: '${section1Content}', elaborate on the background and context using information from this database: ${database}`;
        const response = await runAssistant(prompt, outputSections[1]);
        await runAssistant3(response, database);
    }

    async function runAssistant3(section2Content, database) {
        const prompt = `Following the background: '${section2Content}', delve into the key methodologies using the database: ${database}`;
        const response = await runAssistant(prompt, outputSections[2]);
        await runAssistant4(response, database);
    }

    async function runAssistant4(section3Content, database) {
        const prompt = `Given the methodology: '${section3Content}', analyze the results and findings based on the database: ${database}`;
        const response = await runAssistant(prompt, outputSections[3]);
        await runAssistant5(response, database);
    }

    async function runAssistant5(section4Content, database) {
        const prompt = `Concluding the analysis: '${section4Content}', write a comprehensive discussion and conclusion using the database: ${database}`;
        await runAssistant(prompt, outputSections[4]);
    }
});
