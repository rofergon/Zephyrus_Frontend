from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import logging
from connection_manager import ConnectionManager
from websocket_handlers import handle_websocket_connection

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Crear una única instancia de ConnectionManager
manager = ConnectionManager()

# WebSocket endpoint con manejo de sesiones
@app.websocket("/ws/agent")
async def websocket_endpoint(websocket: WebSocket, wallet_address: str | None = None):
    await handle_websocket_connection(websocket, wallet_address, manager)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 