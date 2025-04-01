from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from uuid import uuid4
from fastapi.responses import StreamingResponse, HTMLResponse
import asyncio
from asyncio import Queue
import json

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Task model
class Task(BaseModel):
    id: str
    name: str
    timeframe: str
    completed: bool

# Task input model (for creating/updating)
class TaskCreate(BaseModel):
    name: str
    timeframe: str
    completed: Optional[bool] = False

# In-memory database
tasks = [
    {"name": "Finish ray implementation", "timeframe": "20 hours", "completed": False, "id": "1"},
    {"name": "Finish database project", "timeframe": "6 days", "completed": False, "id": "2"},
    {"name": "Finish courses", "timeframe": "4.5 months", "completed": False, "id": "3"},
    {"name": "Finish PhD", "timeframe": "4.42 years", "completed": False, "id": "4"},
    {"name": "Succeed", "timeframe": "33.15 years", "completed": False, "id": "5"},
]

# Create a broadcast queue for SSE
broadcast_queue = Queue()

# Helper function to format SSE message
def format_sse(data: str, event=None) -> str:
    msg = f"data: {data}\n\n"
    if event:
        msg = f"event: {event}\n{msg}"
    return msg

# HTML content with stop server button
STOP_SERVER_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Task Manager with Controls</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
        }
        .server-controls {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
        }
        .stop-button {
            background-color: #f44336;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        .stop-button:hover {
            background-color: #d32f2f;
        }
    </style>
</head>
<body>
    <div class="server-controls">
        <button id="stop-server" class="stop-button">Stop Server</button>
    </div>
    
    <script>
        document.getElementById('stop-server').addEventListener('click', () => {
            if (window.electronAPI) {
                window.electronAPI.stopServer();
            } else {
                alert('This button only works in the Electron app');
            }
        });
    </script>
</body>
</html>
"""

# SSE endpoint
@app.get("/events")
async def events(request: Request):
    print(f"New SSE connection established from {request.client.host}")
    async def event_generator():
        # Send initial data
        print("Sending initial data to new SSE client")
        yield format_sse(json.dumps({"tasks": tasks}), event="initial")
        
        # Create a new queue for this client
        client_queue = Queue()
        
        # Add this client's queue to the main broadcast queue
        print("Adding client to broadcast queue")
        task = asyncio.create_task(broadcast_queue.put(client_queue))
        
        try:
            while True:
                # Wait for new data
                print("Client waiting for updates...")
                data = await client_queue.get()
                if data is None:  # None is our signal to stop
                    print("Received stop signal for client")
                    break
                print(f"Sending update to client: {data}")
                yield format_sse(json.dumps(data), event="update")
                
        except asyncio.CancelledError:
            # Client disconnected
            print(f"Client disconnected from {request.client.host}")
            pass
        finally:
            # Clean up
            print("Cleaning up client resources")
            task.cancel()
            
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

# Helper function to broadcast to all connected clients
async def broadcast(data):
    print(f"Broadcasting to clients: {data}")
    # Get all client queues
    if broadcast_queue.qsize() > 0:
        print(f"Number of connected clients: {broadcast_queue.qsize()}")
        client_queues = []
        for _ in range(broadcast_queue.qsize()):
            client_queue = await broadcast_queue.get()
            client_queues.append(client_queue)
        
        # Send data to all clients
        for client_queue in client_queues:
            await client_queue.put(data)
            # Put the client back into the broadcast queue
            await broadcast_queue.put(client_queue)
        print(f"Broadcast complete to {len(client_queues)} clients")
    else:
        print("No connected clients to broadcast to")

@app.get("/", response_class=HTMLResponse)
def read_root():
    # Inject the control panel HTML
    return STOP_SERVER_HTML + """
    <div style="padding: 20px;">
        <h1>Task API is running</h1>
        <p>You can access the API at <a href="/docs">/docs</a>.</p>
    </div>
    """

@app.get("/tasks", response_model=List[Task])
def get_tasks():
    return tasks

@app.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: str):
    for task in tasks:
        if task["id"] == task_id:
            return task
    raise HTTPException(status_code=404, detail="Task not found")

@app.post("/tasks", response_model=Task)
async def push_task(task: TaskCreate):
    """Push a new task onto the stack (at the beginning)"""
    new_task = task.dict()
    new_task["id"] = str(uuid4())[:8]  # Generate a short ID
    tasks.insert(0, new_task)  # Push to beginning (top of stack)
    
    # Broadcast the task update to all connected clients
    await broadcast({"action": "push", "task": new_task})
    
    return new_task

@app.delete("/tasks/pop", response_model=Task)
async def pop_task():
    """Pop a task from the stack (remove from beginning)"""
    if not tasks:
        raise HTTPException(status_code=404, detail="No tasks to pop")
    
    popped_task = tasks.pop(0)  # Pop from beginning
    
    print(f"Popping task: {popped_task['id']} - {popped_task['name']}")
    
    # Broadcast the pop action
    broadcast_data = {"action": "pop", "task_id": popped_task["id"]}
    print(f"Broadcasting pop event: {broadcast_data}")
    await broadcast(broadcast_data)
    
    return popped_task

@app.patch("/tasks/{task_id}/toggle", response_model=Task)
async def toggle_task_completion(task_id: str):
    for i, task in enumerate(tasks):
        if task["id"] == task_id:
            tasks[i]["completed"] = not tasks[i]["completed"]
            
            # Broadcast the task update
            await broadcast({"action": "update", "task": tasks[i]})
            
            return tasks[i]
    raise HTTPException(status_code=404, detail="Task not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
