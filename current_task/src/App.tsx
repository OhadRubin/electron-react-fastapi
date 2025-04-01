import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import './App.css';



interface Task {
  id: string;
  name: string;
  timeframe: string;
  completed: boolean;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [showHeader, setShowHeader] = useState(false);
  
  // Fetch tasks from API
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:8001/tasks');
        if (!response.ok) {
          throw new Error('Failed to fetch tasks');
        }
        const data = await response.json();
        setTasks(data);
        setError('');
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setError('Failed to load tasks. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);
  
  // Connect to SSE endpoint
  useEffect(() => {
    // Create EventSource connection
    const eventSource = new EventSource('http://localhost:8001/events');
    
    // Handle initial data
    eventSource.addEventListener('initial', (event) => {
      try {
        console.log('SSE: Received initial data', event.data);
        const data = JSON.parse(event.data);
        if (data.tasks) {
          setTasks(data.tasks);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error parsing initial event data:', err);
      }
    });
    
    // Handle updates
    eventSource.addEventListener('update', (event) => {
      try {
        console.log('SSE: Received update event', event.data);
        const data = JSON.parse(event.data);
        
        if (data.action === 'push') {
          console.log('SSE: Processing push action', data.task);
          // Add new task to the beginning of the array (push to stack)
          setTasks(currentTasks => [data.task, ...currentTasks]);
          
          // Show a brief notification
          const notification = document.createElement('div');
          notification.className = 'fixed bottom-8 right-8 bg-green-500 text-white p-4 rounded-lg shadow-lg';
          notification.textContent = `New task added: ${data.task.name}`;
          document.body.appendChild(notification);
          
          // Remove notification after 3 seconds
          setTimeout(() => {
            notification.remove();
          }, 3000);
          
          // Scroll to the newly added task (which will be at the bottom of the display after reversal)
          setTimeout(() => {
            if (scrollContainerRef.current) {
              // Last task element is the first/newest task in the data but appears at the bottom due to reversal
              const lastTaskElement = scrollContainerRef.current.querySelector('.task-item:last-child');
              if (lastTaskElement) {
                lastTaskElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }
          }, 100); // Small delay to ensure DOM has updated
        } 
        else if (data.action === 'pop') {
          console.log('SSE: Processing pop action', data.task_id);
          // Remove the first task from the stack (most recent one)
          setTasks(currentTasks => currentTasks.filter(task => task.id !== data.task_id));
          
          // Show a notification
          const notification = document.createElement('div');
          notification.className = 'fixed bottom-8 right-8 bg-blue-500 text-white p-4 rounded-lg shadow-lg';
          notification.textContent = 'Task completed and removed from stack';
          document.body.appendChild(notification);
          
          // Remove notification after 3 seconds
          setTimeout(() => {
            notification.remove();
          }, 3000);
        }
        else if (data.action === 'update') {
          console.log('SSE: Processing update action', data.task);
          // Update existing task
          setTasks(currentTasks => 
            currentTasks.map(task => 
              task.id === data.task.id ? data.task : task
            )
          );
        }
      } catch (err) {
        console.error('Error handling update event:', err);
      }
    });
    
    // Handle connection error
    eventSource.onerror = (error) => {
      console.error('EventSource connection error', error);
      eventSource.close();
    };
    
    // Cleanup function
    return () => {
      eventSource.close();
    };
  }, []);
  
  // Auto-scroll to bottom (first task) on component mount
  useEffect(() => {
    if (tasks.length > 0 && scrollContainerRef.current) {
      // Get the last task element
      const lastTaskElement = scrollContainerRef.current.querySelector('.task-item:last-child');
      
      if (lastTaskElement) {
        // Use scrollIntoView to respect snap points and scroll padding
        lastTaskElement.scrollIntoView({ block: 'start' });
      }
    }
  }, [tasks.length]);
  
  // Handle scroll to update current task index and header visibility
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const scrollPosition = container.scrollTop;
        const totalHeight = container.scrollHeight - container.clientHeight;
        
        // Show header when not at the bottom
        setShowHeader(scrollPosition < totalHeight);
        
        // Find which task element is most visible in the viewport
        const taskElements = Array.from(container.querySelectorAll('.task-item'));
        let mostVisibleIndex = 0;
        let maxVisibleArea = 0;
        
        taskElements.forEach((el, idx) => {
          const rect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // Calculate how much of the element is visible in the viewport
          const visibleTop = Math.max(rect.top, containerRect.top);
          const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          
          // Update if this element has more visible area than previous max
          if (visibleHeight > maxVisibleArea) {
            maxVisibleArea = visibleHeight;
            // Convert from reversed display index to original task index
            mostVisibleIndex = tasks.length - 1 - idx;
          }
        });
        
        setCurrentTaskIndex(mostVisibleIndex);
      }
    };
    
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [tasks]);
  
  const toggleTaskCompletion = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:8001/tasks/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle task');
      }
      
      const updatedTask = await response.json();
      
      // Update local state to reflect the change
      setTasks(tasks.map(task => 
        task.id === id ? { ...task, completed: updatedTask.completed } : task
      ));
    } catch (err) {
      console.error('Error toggling task:', err);
      setError('Failed to update task. Please try again.');
    }
  };

  // New function to pop a task
  const popTask = async () => {
    try {
      const response = await fetch('http://localhost:8001/tasks/pop', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to pop task');
      }
      
      // No need to update local state as SSE will handle it
    } catch (err) {
      console.error('Error popping task:', err);
      setError('Failed to pop task. Please try again.');
    }
  };

  // Reverse the tasks array to display them in reverse order (long-term at top, short-term at bottom)
  const reversedTasks = [...tasks].reverse();

  // Get previous task in the timeline (which would be the "next" one to see when scrolling up)
  const getNextVisibleTask = () => {
    // When at index tasks.length-1, there is no next task (we're at the top/longest term task)
    if (currentTaskIndex >= tasks.length - 1) return null;
    
    // The next task when scrolling up is the one with a higher index in the original array
    return tasks[currentTaskIndex + 1];
  };
  
  const nextTask = getNextVisibleTask();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading tasks...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Floating Pop Task button */}
      <motion.button
        className="fixed right-8 top-8 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full shadow-lg z-20 flex items-center"
        onClick={popTask}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Pop Task
      </motion.button>

      {/* Fixed header showing next task */}
      {showHeader && nextTask && (
        <motion.div 
          className="fixed bottom-0 left-0 right-0 bg-white shadow-md p-4 pt-6 z-10 flex items-center"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="max-w-screen-2xl mx-auto w-full px-6 sm:px-8 lg:px-10 flex items-center">
            <div 
              className={`w-8 h-8 rounded-full mr-4 flex-shrink-0 ${nextTask.completed ? 'bg-green-100 border-2 border-green-500' : 'border-2 border-gray-400'}`}
            >
              {nextTask.completed && (
                <svg className="w-full h-full text-green-500" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" fill="currentColor" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500">Next in queue:</p>
              <h3 className={`text-xl font-bold ${nextTask.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {nextTask.name} - {nextTask.timeframe}
              </h3>
            </div>
          </div>
        </motion.div>
      )}

      <div className="min-h-screen flex flex-col">
        <main className="max-w-screen-2xl mx-auto px-6 sm:px-8 lg:px-10 mb-4 pt-32">
          <div 
            ref={scrollContainerRef}
            className="overflow-y-auto max-h-screen pb-40 pt-32 snap-y snap-mandatory [scroll-padding-top:4rem]"
          >
            {reversedTasks.map((task) => (
              <motion.div
                key={task.id}
                className="bg-white shadow-lg rounded-lg p-12 pt-6 mb-6 mt-8 h-[76vh] w-full flex flex-col justify-center snap-start task-item"
                initial={{ opacity: 0, y: 100 }}
                whileInView={{ 
                  opacity: 1, 
                  y: 0,
                  transition: { 
                    duration: 0.5,
                    ease: "easeOut"
                  }
                }}
                viewport={{ once: false, amount: 0.6 }}
              >
                <div className="flex items-center mb-12">
                  <motion.div
                    className="w-20 h-20 rounded-full flex items-center justify-center cursor-pointer"
                    onClick={() => toggleTaskCompletion(task.id)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    style={{ 
                      borderWidth: '4px',
                      borderColor: task.completed ? '#10B981' : '#9CA3AF', 
                      backgroundColor: task.completed ? '#ECFDF5' : 'transparent'
                    }}
                  >
                    {task.completed && (
                      <motion.svg
                        className="w-14 h-14 text-green-500"
                        viewBox="0 0 20 20"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" fill="currentColor" />
                      </motion.svg>
                    )}
                  </motion.div>
                  <motion.h2
                    className={`text-8xl font-bold ml-10 ${task.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                  >
                    {task.name}
                  </motion.h2>
                </div>
                <motion.div 
                  className="text-6xl font-bold text-gray-600"
                  style={{ marginLeft: '8rem' }}
                >
                  {task.timeframe}
                </motion.div>
              </motion.div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;