import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('hms-theme');
        return saved === 'dark';
    });

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('hms-theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('hms-theme', 'light');
        }
    }, [isDark]);

    const toggle = () => setIsDark(prev => !prev);

    return (
        <ThemeContext.Provider value={{ isDark, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
