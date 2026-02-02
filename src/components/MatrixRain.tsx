"use client";

import { useEffect, useState, memo } from "react";

const MatrixRain = () => {
    const [columns, setColumns] = useState<{ id: number; left: string; delay: string; duration: string; content: string }[]>([]);

    useEffect(() => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]@";
        const columnCount = Math.floor(window.innerWidth / 25);
        
        const newColumns = Array.from({ length: columnCount }).map((_, i) => ({
            id: i,
            left: `${(i / columnCount) * 100}%`,
            delay: `${Math.random() * 5}s`,
            duration: `${5 + Math.random() * 10}s`,
            content: Array.from({ length: 20 }).map(() => chars[Math.floor(Math.random() * chars.length)]).join("")
        }));
        
        setColumns(newColumns);
    }, []);

    return (
        <div className="matrix-bg">
            {columns.map((col) => (
                <div
                    key={col.id}
                    className="matrix-column opacity-30"
                    style={{
                        left: col.left,
                        animationDelay: col.delay,
                        animationDuration: col.duration,
                    }}
                >
                    {col.content}
                </div>
            ))}
        </div>
    );
};

export default memo(MatrixRain);
