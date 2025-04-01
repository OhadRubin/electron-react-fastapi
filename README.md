# FastAPI Task Manager with React UI

## GitHub Repository



This application combines a FastAPI backend with a React frontend, wrapped in an Electron system tray application.

## Features

- System tray app for easy access
- FastAPI backend for task management
- Modern React frontend with animations
- Real-time updates using Server-Sent Events (SSE)
- Auto-start option at system boot

## Installation


### Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd <repository-folder>
   ```

2. Install Node.js dependencies:
   ```
   npm install
   ```

3. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Install React app dependencies:
   ```
   cd current_task
   npm install
   cd ..
   ```

## Usage

### Development Mode

To run the application in development mode:

```
npm start
```

This will:
1. Launch the Electron app in your system tray
2. Start the FastAPI server on port 8001
3. The React app will be started on demand when you open the interface

### System Tray Options

The system tray icon provides several options:

- **Start/Stop Server**: Toggle the FastAPI server
- **Open FastAPI Interface**: Opens the React UI in your default browser
- **Start/Stop React App**: Manually control the React development server
- **Enable/Disable Auto-start**: Configure the app to start automatically at system boot
- **Quit**: Close the application completely

### Task Management

The React UI allows you to:

1. View all tasks in a stack format (long-term goals at the top, short-term at the bottom)
2. Mark tasks as complete by clicking the circle icon
3. Remove the top-most task from the stack with the "Pop Task" button
4. Receive real-time updates when tasks change

## Building for Production

To build the application for your platform:

```
# For macOS
npm run build:mac

# For Windows
npm run build:win

# For Linux
npm run build:linux
```

The packaged application will be available in the `dist` folder.

## Architecture

- **Electron App**: Manages the system tray and controls server processes
- **FastAPI Backend**: Provides REST API endpoints and SSE for real-time updates
- **React Frontend**: Modern UI for task visualization and management

## Troubleshooting

- **Server fails to start**: Check if port 8001 is already in use
- **React app doesn't load**: Ensure port 3000 is available
- **Tasks don't update in real-time**: Verify the server is running and SSE connection is established

## License

[MIT License](LICENSE) # electron-react-fastapi
