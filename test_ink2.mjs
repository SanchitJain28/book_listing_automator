import React from 'react';
import { render, Text } from 'ink';

const App = () => React.createElement(Text, null, "Hello from Ink without JSX!");

render(React.createElement(App));
