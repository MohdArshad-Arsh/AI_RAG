import { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDayName(dateStr) {
    const date = new Date(dateStr);
    return dayNames[date.getDay()];
}

export default function WeeklyQuestionsChart() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios
            .get('/api/analytics/query-trend')
            .then(res => {
                let trendData = Array.isArray(res.data) ? res.data : [];
                // Sort by date ascending
                trendData = [...trendData].sort((a, b) => new Date(a.date) - new Date(b.date));
                // Transform: add day name, ensure count exists
                const transformed = trendData.map(item => ({
                    date: item.date,
                    day: getDayName(item.date),
                    count: item.count ?? 0,
                }));
                setData(transformed);
            })
            .catch(() => {
                setData([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    return (
        <div className="bg-surface border border-white/5 rounded-xl p-4">
            <div className="text-sm font-semibold mb-4">
                Weekly Questions Trend
            </div>

            {loading ? (
                <div className="text-xs text-white/50">Loading...</div>
            ) : data.length === 0 ? (
                <div className="text-xs text-white/50">No data available</div>
            ) : (
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={data}>
                        <XAxis
                            dataKey="day"
                            stroke="rgba(255,255,255,0.2)"
                            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                        />
                        <YAxis
                            stroke="rgba(255,255,255,0.2)"
                            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(20,20,30,0.9)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                            }}
                            labelStyle={{ color: '#fff' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="count"
                            stroke="#3b82f6"
                            dot={{ fill: '#3b82f6', r: 5 }}
                            activeDot={{ r: 7 }}
                            isAnimationActive={true}
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}

