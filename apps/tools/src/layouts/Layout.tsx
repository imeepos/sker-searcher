import React from 'react';
import { Outlet } from 'react-router-dom';

export const Layout: React.FC<React.PropsWithChildren & {}> = ({ children }) => {
    return (
        <div>
            <h2 className="title">hello</h2>
            <Outlet />
        </div>
    );
};
