// src/components/common/SocketTester.js
import React, { useState, useEffect, useRef } from 'react';
import { useSocketContext } from '../../context/SocketContext';

const SocketTester = () => {
  const { socket, isConnected, socketError, connectSocket, manualDisconnect, sessionInfo } = useSocketContext();
  const [testResults, setTestResults] = useState([]);
  const [pingResponse, setPingResponse] = useState(null);
  const [pingTime, setPingTime] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [reconnectStatus, setReconnectStatus] = useState(null);
  const [socketDetails, setSocketDetails] = useState(null);
  const [connectionHistory, setConnectionHistory] = useState([]);
  const [eventCount, setEventCount] = useState({});
  const lastPingTime = useRef(null);
  const reconnectTimer = useRef(null);
  const eventCounterRef = useRef({});

  // Add a new log entry with timestamp
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
    setTestResults(prev => [...prev, { timestamp, message, type }]);
  };

  // Increment event counter
  const incrementEventCount = (eventName) => {
    eventCounterRef.current[eventName] = (eventCounterRef.current[eventName] || 0) + 1;
    setEventCount({...eventCounterRef.current});
  };

  // Test socket connection with a ping
  const testPing = () => {
    if (!socket) {
      addLog('Socket is null, cannot send ping', 'error');
      return;
    }

    setPingResponse(null);
    lastPingTime.current = Date.now();
    addLog('Sending ping to server...', 'info');

    try {
      socket.emit('ping_test', { timestamp: lastPingTime.current }, (response) => {
        const roundTripTime = Date.now() - lastPingTime.current;
        setPingTime(roundTripTime);
        setPingResponse(response);
        addLog(`Ping successful! Round trip: ${roundTripTime}ms`, 'success');
        console.log('Ping response:', response);
        incrementEventCount('ping_response');
      });

      // Set a timeout to detect if the ping fails
      setTimeout(() => {
        if (lastPingTime.current && !pingResponse) {
          addLog('Ping timed out after 3s', 'error');
          incrementEventCount('ping_timeout');
        }
      }, 3000);
    } catch (err) {
      addLog(`Ping failed with error: ${err.message}`, 'error');
      console.error('Ping error:', err);
    }
  };

  // Test reconnection capability
  const testReconnect = () => {
    if (!socket) {
      addLog('Socket is null, cannot test reconnection', 'error');
      return;
    }

    addLog('Testing reconnection capability...', 'info');
    setReconnectStatus('in-progress');
    setReconnectAttempts(0);
    
    // Manually disconnect first
    manualDisconnect();
    addLog('Manually disconnected socket, attempting to reconnect in 1s...', 'info');
    
    // Set a timer to reconnect after 1 second
    reconnectTimer.current = setTimeout(() => {
      try {
        connectSocket();
        addLog('Reconnect attempt initiated', 'info');
        
        // Set a timer to check if reconnection succeeded
        setTimeout(() => {
          if (isConnected) {
            setReconnectStatus('success');
            addLog('Reconnection successful!', 'success');
          } else {
            setReconnectStatus('failed');
            addLog('Reconnection failed within timeout period', 'error');
          }
        }, 5000); // Allow 5 seconds for reconnection
      } catch (err) {
        addLog(`Reconnect failed with error: ${err.message}`, 'error');
        setReconnectStatus('failed');
      }
    }, 1000);
  };

  // Get detailed socket information
  const getSocketDetails = () => {
    if (!socket) {
      addLog('Socket is null, cannot get details', 'error');
      return;
    }

    try {
      const details = {
        id: socket.id,
        connected: socket.connected,
        disconnected: socket.disconnected,
        transport: socket._opts?.transports,
        currentTransport: socket.io.engine?.transport?.name,
        namespace: socket.nsp,
        auth: !!socket.auth,
        options: socket._opts,
        backoff: socket.io?.backoff?.ms,
        pingInterval: socket.io?.opts?.pingInterval,
        pingTimeout: socket.io?.opts?.pingTimeout,
        reconnection: socket.io?.opts?.reconnection,
        reconnectionAttempts: socket.io?.opts?.reconnectionAttempts,
        reconnectionDelay: socket.io?.opts?.reconnectionDelay,
        socket_listeners: Object.keys(socket._callbacks || {}),
        engine_state: socket.io?.engine?.readyState
      };

      setSocketDetails(details);
      addLog('Retrieved socket details', 'success');
    } catch (err) {
      addLog(`Error getting socket details: ${err.message}`, 'error');
      console.error('Socket details error:', err);
    }
  };

  // Clear all logs
  const clearLogs = () => {
    setTestResults([]);
    setPingResponse(null);
    setPingTime(null);
    setReconnectStatus(null);
    setSocketDetails(null);
  };

  // Reset counters
  const resetCounters = () => {
    eventCounterRef.current = {};
    setEventCount({});
    setConnectionHistory([]);
    addLog('All counters and history reset', 'info');
  };
  
  // Test specific events
  const testConnectionAck = () => {
    if (!socket) {
      addLog('Socket is null, cannot test connection acknowledgment', 'error');
      return;
    }
    
    // Disconnect and reconnect to trigger connection_ack
    addLog('Disconnecting and reconnecting to test connection_ack event...', 'info');
    manualDisconnect();
    
    setTimeout(() => {
      connectSocket();
      addLog('Reconnection initiated to test connection_ack', 'info');
    }, 1000);
  };

  // Effect to track connection state changes
  useEffect(() => {
    if (isConnected) {
      addLog(`Socket connected with ID: ${socket?.id}`, 'success');
      setConnectionHistory(prev => [...prev, { 
        event: 'connected', 
        time: new Date().toISOString(),
        id: socket?.id
      }]);
      incrementEventCount('connect');
    } else if (socketError) {
      addLog(`Socket error: ${socketError}`, 'error');
      setConnectionHistory(prev => [...prev, { 
        event: 'error', 
        time: new Date().toISOString(),
        error: socketError
      }]);
      incrementEventCount('error');
    }
  }, [isConnected, socketError, socket]);

  // Effect to track reconnection attempts
  useEffect(() => {
    const handleReconnectAttempt = (attempt) => {
      setReconnectAttempts(attempt);
      addLog(`Reconnection attempt #${attempt}`, 'info');
      incrementEventCount('reconnect_attempt');
    };

    if (socket) {
      socket.on('reconnect_attempt', handleReconnectAttempt);
      
      socket.on('reconnect', (attempt) => {
        addLog(`Socket reconnected successfully after ${attempt} attempts`, 'success');
        incrementEventCount('reconnect');
      });
      
      socket.on('reconnect_error', (error) => {
        addLog(`Reconnection error: ${error}`, 'error');
        incrementEventCount('reconnect_error');
      });
      
      socket.on('reconnect_failed', () => {
        addLog('Socket failed to reconnect after all attempts', 'error');
        incrementEventCount('reconnect_failed');
      });

      socket.on('connection_ack', (data) => {
        addLog(`Received connection_ack from server: ${JSON.stringify(data)}`, 'success');
        incrementEventCount('connection_ack');
      });

      socket.on('error', (error) => {
        addLog(`Received error event: ${error}`, 'error');
        incrementEventCount('error_event');
      });

      socket.on('connect_error', (error) => {
        addLog(`Connect error: ${error.message}`, 'error');
        incrementEventCount('connect_error');
      });

      socket.on('disconnect', (reason) => {
        addLog(`Socket disconnected: ${reason}`, 'warn');
        setConnectionHistory(prev => [...prev, { 
          event: 'disconnected', 
          time: new Date().toISOString(),
          reason
        }]);
        incrementEventCount('disconnect');
      });
    }

    return () => {
      if (socket) {
        socket.off('reconnect_attempt', handleReconnectAttempt);
        socket.off('reconnect');
        socket.off('reconnect_error');
        socket.off('reconnect_failed');
        socket.off('connection_ack');
        socket.off('error');
        socket.off('connect_error');
        socket.off('disconnect');
      }
      
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [socket]);

  // Component cleanup
  useEffect(() => {
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, []);

  // Add initial connection log
  useEffect(() => {
    addLog('Socket Tester initialized', 'info');
    if (socket) {
      addLog(`Initial socket state: ${isConnected ? 'Connected' : 'Disconnected'}`, 'info');
      setConnectionHistory([{ 
        event: isConnected ? 'connected' : 'disconnected', 
        time: new Date().toISOString(),
        id: socket?.id || 'none'
      }]);
    } else {
      addLog('Socket is null', 'warn');
      setConnectionHistory([{ 
        event: 'null', 
        time: new Date().toISOString()
      }]);
    }
    
    // Return cleanup function
    return () => {
      addLog('Socket Tester component unmounting', 'info');
    };
  }, [isConnected, socket]); // Added dependencies to fix the eslint warning

  return (
    <div className="socket-tester" style={styles.container}>
      <h2 style={styles.heading}>Socket.IO Connection Tester</h2>
      
      <div style={styles.statusSection}>
        <h3>Connection Status</h3>
        <div style={styles.statusDisplay}>
          <div>
            <span>Connected: </span>
            <span style={{
              color: isConnected ? 'green' : 'red',
              fontWeight: 'bold'
            }}>
              {isConnected ? 'Yes' : 'No'}
            </span>
          </div>
          
          <div>
            <span>Socket ID: </span>
            <span style={{fontWeight: 'bold'}}>
              {socket?.id || 'Not Available'}
            </span>
          </div>

          <div>
            <span>Transport: </span>
            <span style={{fontWeight: 'bold'}}>
              {socket?.io?.engine?.transport?.name || 'Not Available'}
              {socket?._opts?.transports ? ` (Available: ${socket._opts.transports.join(', ')})` : ''}
            </span>
          </div>

          {sessionInfo && (
            <div>
              <span>Session Info: </span>
              <pre style={styles.sessionInfo}>
                {JSON.stringify(sessionInfo, null, 2)}
              </pre>
            </div>
          )}
          
          {socketError && (
            <div style={{color: 'red'}}>
              <span>Error: </span>
              <span>{socketError}</span>
            </div>
          )}
        </div>
      </div>
      
      <div style={styles.testControls}>
        <h3>Test Controls</h3>
        <div style={styles.buttonGroup}>
          <button 
            style={styles.button} 
            onClick={testPing}
            disabled={!isConnected}
          >
            Test Ping
          </button>
          <button 
            style={styles.button} 
            onClick={testReconnect}
            disabled={reconnectStatus === 'in-progress'}
          >
            Test Reconnect
          </button>
          <button 
            style={{...styles.button, backgroundColor: '#007bff'}} 
            onClick={connectSocket}
            disabled={isConnected}
          >
            Connect
          </button>
          <button 
            style={{...styles.button, backgroundColor: '#dc3545'}} 
            onClick={manualDisconnect}
            disabled={!isConnected}
          >
            Disconnect
          </button>
          <button 
            style={{...styles.button, backgroundColor: '#17a2b8'}} 
            onClick={getSocketDetails}
            disabled={!socket}
          >
            Socket Details
          </button>
          <button 
            style={{...styles.button, backgroundColor: '#6610f2'}} 
            onClick={testConnectionAck}
            disabled={!socket}
          >
            Test Connection Ack
          </button>
          <button 
            style={{...styles.button, backgroundColor: '#fd7e14'}} 
            onClick={resetCounters}
          >
            Reset Counters
          </button>
          <button 
            style={{...styles.button, backgroundColor: '#6c757d'}} 
            onClick={clearLogs}
          >
            Clear Logs
          </button>
        </div>
        
        {pingResponse && (
          <div style={styles.resultSection}>
            <h3>Ping Results</h3>
            <p>Round Trip Time: <strong>{pingTime}ms</strong></p>
            <pre style={styles.jsonResult}>
              {JSON.stringify(pingResponse, null, 2)}
            </pre>
          </div>
        )}
        
        {reconnectStatus && (
          <div style={styles.resultSection}>
            <h3>Reconnect Test</h3>
            <p>Status: <strong style={{
              color: reconnectStatus === 'success' ? 'green' : 
                     reconnectStatus === 'failed' ? 'red' : 'orange'
            }}>
              {reconnectStatus === 'success' ? 'Successful' : 
               reconnectStatus === 'failed' ? 'Failed' : 'In Progress'}
            </strong></p>
            {reconnectAttempts > 0 && (
              <p>Attempts: <strong>{reconnectAttempts}</strong></p>
            )}
          </div>
        )}

        {socketDetails && (
          <div style={styles.resultSection}>
            <h3>Socket Details</h3>
            <pre style={styles.jsonResult}>
              {JSON.stringify(socketDetails, null, 2)}
            </pre>
          </div>
        )}

        {Object.keys(eventCount).length > 0 && (
          <div style={styles.resultSection}>
            <h3>Event Counters</h3>
            <div style={styles.eventCounters}>
              {Object.entries(eventCount).map(([event, count]) => (
                <div key={event} style={styles.eventCounter}>
                  <span style={styles.eventName}>{event}:</span>
                  <span style={styles.eventCount}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {connectionHistory.length > 0 && (
          <div style={styles.resultSection}>
            <h3>Connection History</h3>
            <div style={styles.connectionHistory}>
              {connectionHistory.map((entry, index) => (
                <div key={index} style={{
                  ...styles.historyEntry,
                  color: entry.event === 'connected' ? 'green' : 
                         entry.event === 'error' ? 'red' : 
                         entry.event === 'disconnected' ? 'orange' : 'gray'
                }}>
                  <span style={styles.historyTime}>{entry.time.split('T')[1].substring(0, 8)}</span>
                  <span style={styles.historyEvent}>{entry.event}</span>
                  {entry.id && <span style={styles.historyDetail}>ID: {entry.id}</span>}
                  {entry.reason && <span style={styles.historyDetail}>Reason: {entry.reason}</span>}
                  {entry.error && <span style={styles.historyDetail}>Error: {entry.error}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div style={styles.logsSection}>
        <h3>Connection Logs</h3>
        <div style={styles.logs}>
          {testResults.length === 0 ? (
            <p style={styles.emptyLogs}>No logs yet</p>
          ) : (
            testResults.map((log, idx) => (
              <div key={idx} style={{
                ...styles.logEntry,
                color: log.type === 'error' ? '#dc3545' : 
                       log.type === 'success' ? '#28a745' : 
                       log.type === 'warn' ? '#ffc107' : '#6c757d'
              }}>
                <span style={styles.timestamp}>[{log.timestamp}]</span> {log.message}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={styles.troubleshootingSection}>
        <h3>Troubleshooting Guide</h3>
        <div style={styles.troubleshootingContent}>
          <h4>Common Issues:</h4>
          <ul style={styles.troubleshootingList}>
            <li>
              <strong>Connection Fails Immediately:</strong> Check if the server is running and accessible at the 
              configured URL ({process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000'}).
            </li>
            <li>
              <strong>Ping Timeouts:</strong> The server might not have the 'ping_test' handler implemented or there 
              might be connectivity issues.
            </li>
            <li>
              <strong>Reconnection Fails:</strong> Server might be rejecting connections or there might be authentication issues.
            </li>
            <li>
              <strong>Transport Issues:</strong> If you see 'polling' as the transport when 'websocket' is preferred, 
              WebSocket protocol might be blocked or unsupported by your network.
            </li>
          </ul>
          
          <h4>Next Steps:</h4>
          <ol style={styles.troubleshootingList}>
            <li>Test basic connection by clicking Connect/Disconnect buttons</li>
            <li>Test server response by clicking Test Ping</li>
            <li>Test reconnection capability with Test Reconnect</li>
            <li>Check Socket Details for configuration issues</li>
            <li>Examine Connection History for patterns of failures</li>
            <li>Check browser console for additional error details</li>
          </ol>
        </div>
      </div>

      <div style={styles.footer}>
        <p>Socket.IO Connection Tester v1.1</p>
        <p>Backend URL: {process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000'}</p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '900px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f8f9fa',
    borderRadius: '10px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  },
  heading: {
    textAlign: 'center',
    borderBottom: '1px solid #dee2e6',
    paddingBottom: '10px',
    marginBottom: '20px'
  },
  statusSection: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '5px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
  },
  statusDisplay: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  testControls: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '5px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
  },
  buttonGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '15px'
  },
  button: {
    padding: '8px 15px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  logsSection: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '5px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
  },
  logs: {
    maxHeight: '300px',
    overflowY: 'auto',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    fontFamily: 'monospace'
  },
  logEntry: {
    marginBottom: '5px',
    fontSize: '14px'
  },
  timestamp: {
    fontWeight: 'bold',
    marginRight: '5px'
  },
  emptyLogs: {
    textAlign: 'center',
    color: '#6c757d',
    fontStyle: 'italic'
  },
  resultSection: {
    margin: '15px 0',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    border: '1px solid #dee2e6'
  },
  jsonResult: {
    backgroundColor: '#f1f1f1',
    padding: '10px',
    borderRadius: '4px',
    overflow: 'auto',
    maxHeight: '200px',
    fontSize: '14px'
  },
  sessionInfo: {
    backgroundColor: '#f1f1f1',
    padding: '10px',
    borderRadius: '4px',
    overflow: 'auto',
    maxHeight: '150px',
    fontSize: '14px'
  },
  eventCounters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  eventCounter: {
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    padding: '5px 10px',
    display: 'flex',
    alignItems: 'center'
  },
  eventName: {
    marginRight: '5px',
    fontSize: '14px'
  },
  eventCount: {
    fontWeight: 'bold',
    fontSize: '14px'
  },
  connectionHistory: {
    maxHeight: '200px',
    overflowY: 'auto',
    padding: '10px',
    backgroundColor: '#f1f1f1',
    borderRadius: '4px'
  },
  historyEntry: {
    padding: '5px',
    marginBottom: '5px',
    borderBottom: '1px solid #dee2e6',
    fontSize: '14px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  historyTime: {
    fontWeight: 'bold'
  },
  historyEvent: {
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  historyDetail: {
    fontStyle: 'italic'
  },
  troubleshootingSection: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '5px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
  },
  troubleshootingContent: {
    fontSize: '14px'
  },
  troubleshootingList: {
    paddingLeft: '20px',
    marginBottom: '15px'
  },
  footer: {
    textAlign: 'center',
    borderTop: '1px solid #dee2e6',
    paddingTop: '10px',
    fontSize: '12px',
    color: '#6c757d'
  }
};

export default SocketTester;
