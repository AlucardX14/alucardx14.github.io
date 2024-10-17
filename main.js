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

function showError(message) {
    const errorModal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorModal.style.display = 'block';

    const closeBtn = errorModal.querySelector('.close');
    closeBtn.onclick = function() {
        errorModal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == errorModal) {
            errorModal.style.display = 'none';
        }
    }
}

function updateProgress(progress) {
    const progressBar = document.querySelector('.progress');
    progressBar.style.width = `${progress}%`;
    if (progress === 100) {
        setTimeout(() => {
            document.getElementById('progressBar').classList.add('hidden');
        }, 1000);
    } else {
        document.getElementById('progressBar').classList.remove('hidden');
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
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
        ],
    });
    log('ChatGoogleGenerativeAI model initialized');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        log('Form submitted');

        const title = document.getElementById('title').value;
        const databaseFile = document.getElementById('database').files[0];
        const style = document.getElementById('style').value;
        const length = document.getElementById('length').value;

        log('Form data:', { title, databaseFileName: databaseFile ? databaseFile.name : 'No file selected', style, length });

        if (!databaseFile) {
            log('Error: No database file selected');
            showError('Please upload a database file');
            return;
        }

        try {
            updateProgress(10);
            log('Reading database file content');
            const database = await readFileContent(databaseFile);
            log('Database file content read successfully', { contentLength: database.length });

            updateProgress(20);
            log('Starting document generation process');
            await runAssistant1(title, database, style, length);
            log('Document generation process completed');
            updateProgress(100);

            document.getElementById('exportOptions').classList.remove('hidden');
        } catch (error) {
            log('Error processing form:', error);
            showError('An error occurred while generating the document. Please try again.');
            updateProgress(0);
        }
    });

    document.getElementById('exportTXT').addEventListener('click', exportTXT);

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

    async function runAssistant(systemInstruction, humanPrompt, outputSection, sectionName) {
        try {
            log(`Preparing to call ${modelConfig.provider} API for ${sectionName}`, {
                systemInstruction: systemInstruction,
                humanPrompt: humanPrompt
            });

            const startTime = Date.now();

            const messages = [
                ["system", systemInstruction],
                ["human", humanPrompt]
            ];

            log(`Full request details for ${sectionName}:`, {
                provider: modelConfig.provider,
                modelName: modelConfig.modelName,
                temperature: modelConfig.temperature,
                messages: messages
            });

            const response = await model.invoke(messages);
            const endTime = Date.now();

            const content = response.content;

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

    async function runAssistant1(title, database, style, length) {
        log('Starting Assistant 1: Introduction');
        const systemInstruction = `You are an AI assistant tasked with writing document introductions. Your output should be concise, informative, and tailored to the given title and database information. The style should be ${style} and the length should be ${length}.`;
        const humanPrompt = `Write an introduction for a document titled '${title}' using information from this database: ${database}`;
        log('Full prompt for Assistant 1:', { systemInstruction, humanPrompt });
        const response = await runAssistant(systemInstruction, humanPrompt, outputSections[0], 'Introduction');
        log('Assistant 1 completed');
        updateProgress(40);
        await runAssistant2(response, database, style, length);
    }

    async function runAssistant2(section1Content, database, style, length) {
        log('Starting Assistant 2: Background and Context');
        const systemInstruction = `You are an AI assistant responsible for elaborating on the background and context of a document. Use the provided introduction and database to create a comprehensive background section. The style should be ${style} and the length should be ${length}.`;
        const humanPrompt = `Based on the introduction: '${section1Content}', elaborate on the background and context using information from this database: ${database}`;
        log('Full prompt for Assistant 2:', { systemInstruction, humanPrompt });
        const response = await runAssistant(systemInstruction, humanPrompt, outputSections[1], 'Background and Context');
        log('Assistant 2 completed');
        updateProgress(60);
        await runAssistant3(response, database, style, length);
    }

    async function runAssistant3(section2Content, database, style, length) {
        log('Starting Assistant 3: Key Methodologies');
        const systemInstruction = `You are an AI assistant specialized in explaining methodologies. Your task is to describe the key methodologies relevant to the document, based on the background provided and the database information. The style should be ${style} and the length should be ${length}.`;
        const humanPrompt = `Following the background: '${section2Content}', delve into the key methodologies using the database: ${database}`;
        log('Full prompt for Assistant 3:', { systemInstruction, humanPrompt });
        const response = await runAssistant(systemInstruction, humanPrompt, outputSections[2], 'Key Methodologies');
        log('Assistant 3 completed');
        updateProgress(75);
        await runAssistant4(response, database, style, length);
    }

    async function runAssistant4(section3Content, database, style, length) {
        log('Starting Assistant 4: Results and Findings');
        const systemInstruction = `You are an AI assistant focused on analyzing and presenting results and findings. Your role is to interpret the methodologies used and present the outcomes based on the database information. The style should be ${style} and the length should be ${length}.`;
        const humanPrompt = `Given the methodology: '${section3Content}', analyze the results and findings based on the database: ${database}`;
        log('Full prompt for Assistant 4:', { systemInstruction, humanPrompt });
        const response = await runAssistant(systemInstruction, humanPrompt, outputSections[3], 'Results and Findings');
        log('Assistant 4 completed');
        updateProgress(90);
        await runAssistant5(response, database, style, length);
    }

    async function runAssistant5(section4Content, database, style, length) {
        log('Starting Assistant 5: Discussion and Conclusion');
        const systemInstruction = `You are an AI assistant tasked with writing comprehensive discussions and conclusions. Your job is to synthesize all the previous sections and provide insightful closing remarks. The style should be ${style} and the length should be ${length}.`;
        const humanPrompt = `Concluding the analysis: '${section4Content}', write a comprehensive discussion and conclusion using the database: ${database}`;
        log('Full prompt for Assistant 5:', { systemInstruction, humanPrompt });
        await runAssistant(systemInstruction, humanPrompt, outputSections[4], 'Discussion and Conclusion');
        log('Assistant 5 completed');
        log('Full document generation process completed');
    }

    function exportTXT() {
        let content = document.getElementById('title').value + '\n\n';
        outputSections.forEach((section, index) => {
            content += `Section ${index + 1}\n${section.innerText}\n\n`;
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generated_document.txt';
        a.click();
        URL.revokeObjectURL(url);
    }
});
