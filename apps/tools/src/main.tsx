import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './layouts/Layout';
import { Welcome } from './pages/Welcome';
import "./main.css";

function main() {
    const rootElement = document.getElementById('root')
    if (rootElement) {
        const root = ReactDOM.createRoot(rootElement)
        root.render(
            <React.StrictMode>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<Layout />}>
                            <Route index={true} element={<Welcome />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </React.StrictMode>
        )
    }
}

main()
