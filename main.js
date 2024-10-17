import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const sections = [
    'Introduction',
    'Background and Context',
    'Key Methodologies',
    'Results and Findings',
    'Discussion and Conclusion'
];

let currentSectionIndex = 0;
let winners = {};

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

    // Set up temperature sliders
    document.querySelectorAll('.temperature-slider').forEach(slider => {
        slider.addEventListener('input', function() {
            this.nextElementSibling.textContent = parseFloat(this.value).toFixed(1);
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        log('Form submitted');

        if (currentSectionIndex >= sections.length) {
            showError('All sections have been generated. You can now export the document.');
            return;
        }

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
            log('Starting section generation process');
            await generateSection(sections[currentSectionIndex], title, database, style, length);
            log('Section generation process completed');
            updateProgress(100);

            currentSectionIndex++;
            if (currentSectionIndex >= sections.length) {
                document.getElementById('exportOptions').classList.remove('hidden');
                form.querySelector('button[type="submit"]').textContent = 'All Sections Generated';
                form.querySelector('button[type="submit"]').disabled = true;
            }
        } catch (error) {
            log('Error processing form:', error);
            showError('An error occurred while generating the section. Please try again.');
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

    async function runAssistant(modelName, temperature, systemInstruction, humanPrompt, outputElement, sectionName) {
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

            outputElement.textContent = content;
            return content;
        } catch (error) {
            log(`Error calling Google Generative AI API for ${sectionName}:`, error);
            outputElement.textContent = 'Error generating content';
            throw error;
        }
    }

    async function generateSection(sectionName, title, database, style, length) {
        const sectionContainer = document.getElementById('sectionContainer');
        sectionContainer.innerHTML = `<h2>${sectionName}</h2>`;

        const systemInstruction = `You are an AI assistant tasked with writing the ${sectionName} section of a document. Your output should be concise, informative, and tailored to the given title and database information. The style should be ${style} and the length should be ${length}.`;
        const humanPrompt = `Write the ${sectionName} section for a document titled '${title}' using information from this database: ${database}`;

        const sectionPromises = Array.from({ length: 5 }, (_, i) => {
            const selector = document.getElementById(`modelSelector${i + 1}`);
            const modelName = selector.querySelector('.model-dropdown').value;
            const temperature = parseFloat(selector.querySelector('.temperature-slider').value);
            const outputElement = document.createElement('div');
            outputElement.className = 'section-output';
            outputElement.contentEditable = true;
            sectionContainer.appendChild(outputElement);

            const selectButton = document.createElement('button');
            selectButton.textContent = 'Select as Winner';
            selectButton.addEventListener('click', () => selectWinner(sectionName, i, outputElement.textContent));
            sectionContainer.appendChild(selectButton);

            return runAssistant(modelName, temperature, systemInstruction, humanPrompt, outputElement, `${sectionName} ${i + 1}`);
        });

        await Promise.all(sectionPromises);
    }

    function selectWinner(sectionName, index, content) {
        winners[sectionName] = { index, content };
        document.querySelectorAll('.section-output').forEach((el, i) => {
            el.classList.toggle('winner', i === index);
        });
        log(`Winner selected for ${sectionName}`, { index, contentPreview: content.substring(0, 100) + '...' });
    }

    function exportTXT() {
        let content = document.getElementById('title').value + '\n\n';

        sections.forEach((section) => {
            content += `${section}:\n\n`;
            if (winners[section]) {
                content += winners[section].content + '\n\n';
            } else {
                content += 'No winner selected for this section.\n\n';
            }
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
