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

function updateNavigationButtons() {
    const prevButton = document.getElementById('prevSection');
    const nextButton = document.getElementById('nextSection');
    const currentSectionDisplay = document.getElementById('currentSectionDisplay');

    prevButton.disabled = currentSectionIndex === 0;
    nextButton.disabled = currentSectionIndex === sections.length - 1;
    currentSectionDisplay.textContent = `Section ${currentSectionIndex + 1} of ${sections.length}: ${sections[currentSectionIndex]}`;
}

document.addEventListener('DOMContentLoaded', () => {
    log('DOM fully loaded and parsed');

    const form = document.getElementById('documentForm');
    const prevButton = document.getElementById('prevSection');
    const nextButton = document.getElementById('nextSection');

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
            log('Starting section generation process');
            await generateSection(sections[currentSectionIndex], title, database, style, length);
            log('Section generation process completed');
            updateProgress(100);

            updateNavigationButtons();
        } catch (error) {
            log('Error processing form:', error);
            showError('An error occurred while generating the section. Please try again.');
            updateProgress(0);
        }
    });

    prevButton.addEventListener('click', () => {
        if (currentSectionIndex > 0) {
            currentSectionIndex--;
            updateNavigationButtons();
            displayCurrentSection();
        }
    });

    nextButton.addEventListener('click', () => {
        if (currentSectionIndex < sections.length - 1) {
            currentSectionIndex++;
            updateNavigationButtons();
            displayCurrentSection();
        }
    });

    document.getElementById('exportTXT').addEventListener('click', exportTXT);

    updateNavigationButtons();

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
            outputElement.addEventListener('input', () => updateWinner(sectionName, i, outputElement.textContent));
            sectionContainer.appendChild(outputElement);

            const selectButton = document.createElement('button');
            selectButton.textContent = 'Select as Winner';
            selectButton.addEventListener('click', () => selectWinner(sectionName, i, outputElement.textContent));
            sectionContainer.appendChild(selectButton);

            return runAssistant(modelName, temperature, systemInstruction, humanPrompt, outputElement, `${sectionName} ${i + 1}`);
        });

        await Promise.all(sectionPromises);

        if (winners[sectionName]) {
            selectWinner(sectionName, winners[sectionName].index, winners[sectionName].content);
        }
    }

    function selectWinner(sectionName, index, content) {
        winners[sectionName] = { index, content };
        document.querySelectorAll('.section-output').forEach((el, i) => {
            el.classList.toggle('winner', i === index);
        });
        log(`Winner selected for ${sectionName}`, { index, contentPreview: content.substring(0, 100) + '...' });
    }

    function updateWinner(sectionName, index, content) {
        if (winners[sectionName] && winners[sectionName].index === index) {
            winners[sectionName].content = content;
            log(`Winner updated for ${sectionName}`, { index, contentPreview: content.substring(0, 100) + '...' });
        }
    }

    function displayCurrentSection() {
        const sectionContainer = document.getElementById('sectionContainer');
        const currentSection = sections[currentSectionIndex];

        if (winners[currentSection]) {
            sectionContainer.innerHTML = `
                <h2>${currentSection}</h2>
                <div class="section-output winner" contenteditable="true">${winners[currentSection].content}</div>
            `;
            const winnerElement = sectionContainer.querySelector('.section-output');
            winnerElement.addEventListener('input', () => updateWinner(currentSection, winners[currentSection].index, winnerElement.textContent));
        } else {
            sectionContainer.innerHTML = `
                <h2>${currentSection}</h2>
                <p>No content generated yet. Click "Generate Current Section" to create content for this section.</p>
            `;
        }
    }

    function exportTXT() {
        let content = document.getElementById('title').value + '\n\n';

        sections.forEach((section) => {
            content += `${section}:\n\n`;
            if (winners[section]) {
                content += winners[section].content + '\n\n';
            } else {
                content += 'No content generated for this section.\n\n';
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
