# server.py
from mcp.server.fastmcp import FastMCP


# Create an MCP server
mcp = FastMCP("Demo")

import requests


@mcp.tool()
def add_task(name: str, timeframe: str, completed: bool) -> str:
    """Add a task"""
    response = requests.post(
        "http://localhost:8001/tasks",
        json={"name": name, "timeframe": timeframe, "completed": completed}
    )
    return f"Task {name} added to the list"


@mcp.tool()
def pop_task() -> str:
    """Pop a task"""
    response = requests.delete("http://localhost:8001/tasks/pop")
    return f"Task popped from the list"


@mcp.tool()
def get_tasks() -> str:
    """Get all tasks"""
    response = requests.get("http://localhost:8001/tasks")
    return str(response.json())


@mcp.tool()
def peek_task() -> str:
    """Get the top task without removing it"""
    response = requests.get("http://localhost:8001/tasks/peek")
    if response.status_code == 404:
        return "No tasks in the list"
    top_task = response.json()
    return f"Top task: {top_task['name']} ({top_task['timeframe']})"
