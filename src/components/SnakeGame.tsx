import { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, RefreshCw } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

const GRID_COLS = 20;
const GRID_ROWS = 17;
const CELL_SIZE = 16; // pixels -> 320 x 272 px
const INITIAL_SNAKE: Position[] = [
  { x: 8, y: 8 },
  { x: 7, y: 8 },
  { x: 6, y: 8 },
];
const INITIAL_DIRECTION = 'RIGHT';
const BASE_SPEED_MS = 135;

export const SnakeGame: React.FC = () => {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position & { isBonus?: boolean }>({ x: 14, y: 8, isBonus: false });
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('waitmate_snake_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const nextDirectionRef = useRef<string>(INITIAL_DIRECTION);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Générer une nourriture aléatoire en dehors du corps du serpent
  const spawnFood = useCallback((currentSnake: Position[]): Position & { isBonus?: boolean } => {
    let newPos: Position;
    let collision = true;
    while (collision) {
      newPos = {
        x: Math.floor(Math.random() * GRID_COLS),
        y: Math.floor(Math.random() * GRID_ROWS),
      };
      collision = currentSnake.some((segment) => segment.x === newPos.x && segment.y === newPos.y);
    }
    const isBonus = Math.random() < 0.25; // 25% de chance de bonus doré
    return { ...newPos!, isBonus };
  }, []);

  // Redémarrer le jeu
  const resetGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    nextDirectionRef.current = INITIAL_DIRECTION;
    setScore(0);
    setIsGameOver(false);
    setFood(spawnFood(INITIAL_SNAKE));
  }, [spawnFood]);

  // Changer de direction de manière sécurisée
  const changeDirection = useCallback((newDir: string) => {
    const current = nextDirectionRef.current;
    if (newDir === 'UP' && current !== 'DOWN') nextDirectionRef.current = 'UP';
    if (newDir === 'DOWN' && current !== 'UP') nextDirectionRef.current = 'DOWN';
    if (newDir === 'LEFT' && current !== 'RIGHT') nextDirectionRef.current = 'LEFT';
    if (newDir === 'RIGHT' && current !== 'LEFT') nextDirectionRef.current = 'RIGHT';
  }, []);

  // Gestion des touches clavier (Flèches, WASD et ZQSD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW', 'KeyZ'].includes(e.code)) {
        e.preventDefault();
        changeDirection('UP');
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        changeDirection('DOWN');
      } else if (['ArrowLeft', 'KeyA', 'KeyQ'].includes(e.code)) {
        e.preventDefault();
        changeDirection('LEFT');
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        changeDirection('RIGHT');
      } else if (e.code === 'Space' && isGameOver) {
        e.preventDefault();
        resetGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection, isGameOver, resetGame]);

  // Boucle de jeu (Game Loop)
  useEffect(() => {
    if (isGameOver) return;

    // Calcul de la vitesse dynamique (accélère légèrement avec le score)
    const currentSpeed = Math.max(65, BASE_SPEED_MS - Math.floor(score / 30) * 8);

    const gameInterval = setInterval(() => {
      setSnake((prevSnake) => {
        const head = prevSnake[0];
        const dir = nextDirectionRef.current;

        let newHead: Position;
        if (dir === 'UP') newHead = { x: head.x, y: head.y - 1 };
        else if (dir === 'DOWN') newHead = { x: head.x, y: head.y + 1 };
        else if (dir === 'LEFT') newHead = { x: head.x - 1, y: head.y };
        else newHead = { x: head.x + 1, y: head.y };

        // Collision avec les murs
        if (
          newHead.x < 0 ||
          newHead.x >= GRID_COLS ||
          newHead.y < 0 ||
          newHead.y >= GRID_ROWS
        ) {
          setIsGameOver(true);
          return prevSnake;
        }

        // Collision avec soi-même
        if (prevSnake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
          setIsGameOver(true);
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        // Manger la nourriture
        if (newHead.x === food.x && newHead.y === food.y) {
          const points = food.isBonus ? 30 : 10;
          setScore((s) => {
            const nextScore = s + points;
            if (nextScore > highScore) {
              setHighScore(nextScore);
              localStorage.setItem('waitmate_snake_highscore', nextScore.toString());
            }
            return nextScore;
          });
          setFood(spawnFood(newSnake));
        } else {
          newSnake.pop(); // Retirer la queue
        }

        return newSnake;
      });
    }, currentSpeed);

    return () => clearInterval(gameInterval);
  }, [food, isGameOver, score, highScore, spawnFood]);

  // Dessin sur Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fond
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grille discrète
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= GRID_COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, GRID_ROWS * CELL_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(GRID_COLS * CELL_SIZE, y * CELL_SIZE);
      ctx.stroke();
    }

    // Dessin de la nourriture
    if (food.isBonus) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(
        food.x * CELL_SIZE + CELL_SIZE / 2,
        food.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 1,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(
        food.x * CELL_SIZE + CELL_SIZE / 2,
        food.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Dessin du serpent
    snake.forEach((segment, idx) => {
      ctx.fillStyle = idx === 0 ? '#38bdf8' : '#64748b';
      ctx.beginPath();
      ctx.roundRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2,
        idx === 0 ? 4 : 3
      );
      ctx.fill();
    });
  }, [snake, food]);

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* Barre de score */}
      <div className="w-full flex items-center justify-between px-2.5 py-1 mb-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] text-slate-400">Score:</span>
          <span className="font-mono font-bold text-slate-200">{score}</span>
        </div>

        <div className="flex items-center space-x-1.5 text-slate-400">
          <Trophy className="w-3 h-3 text-amber-400" />
          <span className="font-mono font-bold text-slate-200">{highScore}</span>
        </div>
      </div>

      {/* Zone Canvas Maximisée & Overlay Game Over */}
      <div className="w-full relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center shadow-inner">
        <canvas
          ref={canvasRef}
          width={GRID_COLS * CELL_SIZE}
          height={GRID_ROWS * CELL_SIZE}
          className="block w-full h-auto"
        />

        {isGameOver && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-3 text-center animate-in fade-in">
            <span className="text-sm font-bold text-rose-400 mb-1 uppercase tracking-wider">
              Game Over
            </span>
            <span className="text-xs text-slate-300 mb-3">{score} points</span>
            <button
              onClick={resetGame}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs cursor-pointer transition-all active:scale-95 shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Play Again (Space)</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Minimaliste */}
      <div className="mt-2 flex items-center justify-between w-full px-1 text-[10px] text-slate-500 font-mono">
        <span>Arrows / WASD / ZQSD</span>
        <span>Space: Restart</span>
      </div>
    </div>
  );
};
