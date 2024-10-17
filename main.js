import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

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

    const introOutputs = [
        document.getElementById('introOutput1'),
        document.getElementById('introOutput2'),
        document.getElementById('introOutput3'),
        document.getElementById('introOutput4'),
        document.getElementById('introOutput5')
    ];

    // Set up temperature sliders
    document.querySelectorAll('.temperature-slider').forEach(slider => {
        slider.addEventListener('input', function() {
            this.nextElementSibling.textContent = parseFloat(this.value).toFixed(1);
        });
    });

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
            await runIntroductions(title, database, style, length);
            log('Introductions generation process completed');
            updateProgress(50);
            await runRemainingAssistants(title, database, style, length);
            log('Full document generation process completed');
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

    async function runAssistant(modelName, temperature, systemInstruction, humanPrompt, outputSection, sectionName) {
        try {
            log(`Preparing to call Google Generative AI API for ${sectionName}`, {
                modelName,
                temperature,
                systemInstruction,
                humanPrompt
            });

            const startTime = Date.now();

            const model = new ChatGoogleGenerativeAI({
                modelName: modelName,
                temperature: temperature,
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

            const messages = [
                ["system", systemInstruction],
                ["human", humanPrompt]
            ];

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
            log(`Error calling Google Generative AI API for ${sectionName}:`, error);
            outputSection.innerHTML = 'Error generating content';
            throw error;
        }
    }

    async function runIntroductions(title, database, style, length) {
        const systemInstruction = `You are an AI assistant tasked with writing document introductions. Your output should be concise, informative, and tailored to the given title and database information. The style should be ${style} and the length should be ${length}.`;
        const humanPrompt = `Write an introduction for a document titled '${title}' using information from this database: ${database}`;

        const introPromises = Array.from({ length: 5 }, (_, i) => {
            const selector = document.getElementById(`modelSelector${i + 1}`);
            const modelName = selector.querySelector('.model-dropdown').value;
            const temperature = parseFloat(selector.querySelector('.temperature-slider').value);
            return runAssistant(modelName, temperature, systemInstruction, humanPrompt, introOutputs[i], `Introduction ${i + 1}`);
        });

        await Promise.all(introPromises);
    }

    async function runRemainingAssistants(title, database, style, length) {
        // Use the first introduction for subsequent sections
        const introContent = introOutputs[0].innerHTML;

        await runAssistant2(introContent, database, style, length);
        await runAssistant3(outputSections[1].innerHTML, database, style, length);
        await runAssistant4(outputSections[2].innerHTML, database, style, length);
        await runAssistant5(outputSections[3].innerHTML, database, style, length);
    }

    async function runAssistant2(section1Content, database, style, length) {
        log('Starting Assistant 2: Background and Context');
        const systemInstruction = `You are an AI assistant responsible for elaborating on the background and context of a document. Use the provided introduction and database to create a comprehensive background section. The style should be ${style} and the length should be ${length}.`;
        const humanPrompt = `Based on the introduction: '${section1Content}', elaborate on the background and context using information from this database: ${database}`;
        await runAssistant('gemini-1.5-flash-002', 0.7, systemInstruction, humanPrompt, outputSections[1], 'Background and Context');
        log('Assistant 2 completed');
        updateProgress(65);
    }

    async function runAssistant3(section2Content, database, style, length) {
        log('Starting Assistant 3: Key Methodologies');
        const systemInstruction = `You are an AI assistant specialized in explaining methodologies. Your task is to describe the key methodologies relevant to the document, based on the background provided and the database information. The style should be ${style} and the length should be ${length}.`;
        const humanPrompt = `Following the background: '${section2Content}', delve into the key methodologies using the database: ${database}`;
        await runAssistant('gemini-1.5-flash-002', 0.7, systemInstruction, humanPrompt, outputSections[2], 'Key Methodologies');
        log('Assistant 3 completed');
        updateProgress(80);
    }

    async function runAssistant4(section3Content, database, style, length) {
        log('Starting Assistant 4: Results and Findings');
        const systemInstruction = `You are an AI assistant focused on analyzing and presenting results and findings. Your role is to interpret the methodologies used and present the outcomes based on the database information. The style should be ${style} and the length should be ${length}.`;
        const humanPrompt = `Given the methodology: '${section3Content}', analyze the results and findings based on the database: ${database}`;
        await runAssistant('gemini-1.5-flash-002', 0.7, systemInstruction, humanPrompt, outputSections[3], 'Results and Findings');
        log('Assistant 4 completed');
        updateProgress(90);
    }

    async function runAssistant5(section4Content, database, style, length) {
        log('Starting Assistant 5: Discussion and Conclusion');
        const systemInstruction = `You are an AI assistant tasked with writing comprehensive discussions and conclusions. Your job is to synthesize all the previous sections and provide insightful closing remarks. The style should be ${style} and the length should be ${length}.`;
        const humanPrompt = `Concluding the analysis: '${section4Content}', write a comprehensive discussion and conclusion using the database: ${database}`;
        await runAssistant('gemini-1.5-flash-002', 0.7, systemInstruction, humanPrompt, outputSections[4], 'Discussion and Conclusion');
        log('Assistant 5 completed');
    }

    function exportTXT() {
        let content = document.getElementById('title').value + '\n\n';
        content += 'Generated Introductions:\n\n';
        introOutputs.forEach((intro, index) => {
            content += `Introduction ${index + 1}:\n${intro.innerText}\n\n`;
        });
        content += 'Generated Document:\n\n';
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
