import React from 'react';
import ReactDOM from 'react-dom';
import { OcrPage } from './pages/OcrPage';
import './styles/main.css';

const App: React.FC = () => {
  return (
    <div className="app">
      <OcrPage />
    </div>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
