import React from 'react';

export default function TaskCard({ task }) {
  return (
    <div style={{ background: '#3e3e3e', padding: '12px', margin: '10px 0', borderRadius: '6px', borderLeft: task.blockedStatus === 'Blocked' ? '4px solid #ef4444' : '4px solid #10b981' }}>
      <h4 style={{ margin: '0 0 6px 0' }}>{task.title}</h4>
      <p style={{ fontSize: '12px', color: '#aaa', margin: '0 0 8px 0' }}>{task.description}</p>
      <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', color: '#ccc' }}>
        <span>Status: {task.status_column || 'Ready'}</span>
        <span>{task.start_date || task.startDate}</span>
      </div>
    </div>
  );
}