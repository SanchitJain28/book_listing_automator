import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React, { useState, useEffect } from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import { AsyncParser } from '@json2csv/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, 'output');
const exportDir = path.join(__dirname, 'export');

const e = React.createElement;

// Helper to recursively find JSON files
function findJsonFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findJsonFiles(fullPath, fileList);
    } else if (file.endsWith('.json')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const App = () => {
  const { exit } = useApp();
  const [files, setFiles] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState('loading'); // loading, selecting, processing, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const foundFiles = findJsonFiles(outputDir).sort();
    if (foundFiles.length === 0) {
      setStatus('error');
      setMessage('No JSON files found in output/ directory.');
      setTimeout(() => exit(), 2000);
    } else {
      setFiles(foundFiles);
      setStatus('selecting');
    }
  }, []);

  useInput((input, key) => {
    if (status !== 'selecting') return;

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(files.length - 1, prev + 1));
    } else if (key.return) {
      handleSelect(files[selectedIndex]);
    }
  });

  const handleSelect = async (selectedFilePath) => {
    setStatus('processing');
    setMessage(`Reading ${path.basename(selectedFilePath)}...`);

    try {
      const fileContent = fs.readFileSync(selectedFilePath, 'utf-8');
      const lines = fileContent.split('\n').filter(Boolean);
      
      const jsonData = lines.map(line => JSON.parse(line));
      
      if (jsonData.length === 0) {
        throw new Error('File is empty or contains invalid JSONL.');
      }

      setMessage(`Converting ${jsonData.length} records to CSV...`);
      
      const parser = new AsyncParser();
      const csv = await parser.parse(jsonData).promise();

      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const originalName = path.basename(selectedFilePath, '.json');
      const csvPath = path.join(exportDir, `${originalName}.csv`);
      
      fs.writeFileSync(csvPath, csv);
      
      setStatus('success');
      setMessage(`Successfully exported to: \n${csvPath}`);
      setTimeout(() => exit(), 3000);
    } catch (err) {
      setStatus('error');
      setMessage(`Error: ${err.message}`);
      setTimeout(() => exit(), 3000);
    }
  };

  if (status === 'loading') {
    return e(Text, { color: 'yellow' }, 'Searching for JSON files...');
  }

  if (status === 'selecting') {
    return e(Box, { flexDirection: 'column' },
      e(Box, { marginBottom: 1 }, 
        e(Text, { bold: true, color: 'cyan' }, 'Select a JSON file to export to CSV:')
      ),
      ...files.map((file, index) => {
        const isSelected = index === selectedIndex;
        const relativePath = path.relative(outputDir, file);
        return e(Text, { key: file, color: isSelected ? 'green' : 'white' },
          isSelected ? `> ${relativePath}` : `  ${relativePath}`
        );
      }),
      e(Box, { marginTop: 1 },
        e(Text, { color: 'gray' }, 'Use Up/Down arrows to navigate, Enter to select.')
      )
    );
  }

  if (status === 'processing') {
    return e(Text, { color: 'yellow' }, `Processing: ${message}`);
  }

  if (status === 'success') {
    return e(Box, { flexDirection: 'column' },
      e(Text, { color: 'green', bold: true }, '✔ Success!'),
      e(Text, null, message)
    );
  }

  if (status === 'error') {
    return e(Text, { color: 'red', bold: true }, `✖ ${message}`);
  }

  return null;
};

render(e(App));
