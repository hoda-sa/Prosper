import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardBody, CardTitle } from 'reactstrap';

const CategoryPieChart = ({
    data,
    title,
    colors,
    height = 300,
    showLegend = true,
    formatCurrency
}) => {
    // Custom tooltip component
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            const total = payload[0].payload.payload?.total ||
                payload.reduce((sum, item) => sum + item.value, 0);

            return (
                <div className="bg-white p-3 border rounded shadow">
                    <p className="mb-1 font-weight-bold">{data.payload.name}</p>
                    <p className="mb-0 text-primary">{data.payload.formattedValue}</p>
                    <p className="mb-0 text-muted small">
                        {((data.value / total) * 100).toFixed(1)}%
                    </p>
                </div>
            );
        }
        return null;
    };

    // Custom label renderer for pie slices
    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        if (percent < 0.05) return null; // Don't show labels for slices smaller than 5%

        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                fontSize="12"
                fontWeight="bold"
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    // Calculate total for center display
    const total = data.reduce((sum, item) => sum + item.value, 0);

    if (!data || data.length === 0) {
        return (
            <Card className="h-100 border-0 shadow-sm">
                <CardBody>
                    <CardTitle className="h5 mb-3">{title}</CardTitle>
                    <div className="text-center py-4">
                        <div className="text-muted">No data available</div>
                    </div>
                </CardBody>
            </Card>
        );
    }

    return (
        <Card className="h-100 border-0 shadow-sm">
            <CardBody>
                <CardTitle className="h5 mb-3">{title}</CardTitle>

                {/* Total amount display */}
                <div className="text-center mb-3">
                    <div className="h4 mb-0">{formatCurrency(total)}</div>
                    <small className="text-muted">Total {title.toLowerCase()}</small>
                </div>

                {/* Pie Chart */}
                <ResponsiveContainer width="100%" height={height}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderCustomLabel}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={colors[index % colors.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        {showLegend && (
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                formatter={(value, entry) => (
                                    <span style={{ color: entry.color }}>
                                        {value}
                                    </span>
                                )}
                            />
                        )}
                    </PieChart>
                </ResponsiveContainer>

                {/* Category breakdown list for smaller screens */}
                <div className="d-md-none mt-3">
                    {data.map((item, index) => (
                        <div key={item.name} className="d-flex justify-content-between align-items-center py-1">
                            <div className="d-flex align-items-center">
                                <div
                                    className="mr-2"
                                    style={{
                                        width: '12px',
                                        height: '12px',
                                        backgroundColor: colors[index % colors.length],
                                        borderRadius: '50%'
                                    }}
                                ></div>
                                <span className="small">{item.name}</span>
                            </div>
                            <span className="small font-weight-bold">{item.formattedValue}</span>
                        </div>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
};

export default CategoryPieChart;