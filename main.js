import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const modelConfig = {
    provider: 'Google Generative AI',
    modelName: 'gemini-1.5-flash',
    temperature: 1
};

function log(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
        console.log(`[${timestamp}] ${message}`, JSON.stringify(data, null, 2));
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    log('DOM fully loaded and parsed');

    const form = document.getElementById('documentForm');
    const outputSections = [
        document.getElementById('section1'),
        document.getElementById('section2'),
        document.getElementById('section3'),
        document.getElementById('section4'),
        document.getElementById('section5')
    ];

    log('Initializing ChatGoogleGenerativeAI model', modelConfig);
    const model = new ChatGoogleGenerativeAI({
        modelName: modelConfig.modelName,
        temperature: modelConfig.temperature,
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
        ],
    });
    log('ChatGoogleGenerativeAI model initialized');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        log('Form submitted');

        const title = document.getElementById('title').value;
        const databaseFile = document.getElementById('database').files[0];

        log('Form data:', { title, databaseFileName: databaseFile ? databaseFile.name : 'No file selected' });

        if (!databaseFile) {
            log('Error: No database file selected');
            alert('Please upload a database file');
            return;
        }

        try {
            log('Reading database file content');
            const database = await readFileContent(databaseFile);
            log('Database file content read successfully', { contentLength: database.length });

            log('Starting document generation process');
            await runAssistant1(title, database);
            log('Document generation process completed');
        } catch (error) {
            log('Error processing form:', error);
            alert('An error occurred while generating the document. Please check the console for details.');
        }
    });

    async function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                log('File read successfully', { fileName: file.name, contentLength: event.target.result.length });
                resolve(event.target.result);
            };
            reader.onerror = (error) => {
                log('Error reading file:', error);
                reject(error);
            };
            reader.readAsText(file);
        });
    }

    async function runAssistant(prompt, outputSection, sectionName) {
        try {
            log(`Preparing to call ${modelConfig.provider} API for ${sectionName}`, { 
                prompt: prompt,
                promptLength: prompt.length
            });

            const startTime = Date.now();

            log(`Full request details for ${sectionName}:`, {
                provider: modelConfig.provider,
                modelName: modelConfig.modelName,
                temperature: modelConfig.temperature,
                prompt: prompt
            });

            const response = await model.invoke(prompt);
            const endTime = Date.now();

            let content;
            if (typeof response === 'string') {
                content = response;
            } else if (response.content) {
                content = response.content;
            } else if (response.text) {
                content = response.text;
            } else {
                throw new Error('Unexpected response format');
            }

            log(`Received response for ${sectionName}`, { 
                responseLength: content.length,
                processingTime: `${endTime - startTime}ms`,
                responsePreview: content.substring(0, 200) + '...'
            });

            outputSection.innerHTML = content;
            return content;
        } catch (error) {
            log(`Error calling ${modelConfig.provider} API for ${sectionName}:`, error);
            outputSection.innerHTML = 'Error generating content';
            throw error;
        }
    }

    async function runAssistant1(title, database) {
        log('Starting Assistant 1: Introduction');
        const prompt = `Write an introduction for a document titled '${title}' using information from this database: ${database}`;
        log('Full prompt for Assistant 1:', { prompt: prompt });
        const response = await runAssistant(prompt, outputSections[0], 'Introduction');
        log('Assistant 1 completed');
        await runAssistant2(response, database);
    }

    async function runAssistant2(section1Content, database) {
        log('Starting Assistant 2: Background and Context');
        const prompt = `Based on the introduction: '${section1Content}', elaborate on the background and context using information from this database: ${database}`;
        log('Full prompt for Assistant 2:', { prompt: prompt });
        const response = await runAssistant(prompt, outputSections[1], 'Background and Context');
        log('Assistant 2 completed');
        await runAssistant3(response, database);
    }

    async function runAssistant3(section2Content, database) {
        log('Starting Assistant 3: Key Methodologies');
        const prompt = `Following the background: '${section2Content}', delve into the key methodologies using the database: ${database}`;
        log('Full prompt for Assistant 3:', { prompt: prompt });
        const response = await runAssistant(prompt, outputSections[2], 'Key Methodologies');
        log('Assistant 3 completed');
        await runAssistant4(response, database);
    }

    async function runAssistant4(section3Content, database) {
        log('Starting Assistant 4: Results and Findings');
        const prompt = `Given the methodology: '${section3Content}', analyze the results and findings based on the database: ${database}`;
        log('Full prompt for Assistant 4:', { prompt: prompt });
        const response = await runAssistant(prompt, outputSections[3], 'Results and Findings');
        log('Assistant 4 completed');
        await runAssistant5(response, database);
    }

    async function runAssistant5(section4Content, database) {
        log('Starting Assistant 5: Discussion and Conclusion');
        const prompt = `Concluding the analysis: '${section4Content}', write a comprehensive discussion and conclusion using the database: ${database}`;
        log('Full prompt for Assistant 5:', { prompt: prompt });
        await runAssistant(prompt, outputSections[4], 'Discussion and Conclusion');
        log('Assistant 5 completed');
        log('Full document generation process completed');
    }
});
