import { Chess } from 'chess.js';
import { registerChessJs, type ChessJsCtor } from './referee';

// Importing this module makes chess.js the rules authority of every new match.
registerChessJs(Chess as unknown as ChessJsCtor);
