// Buendelt die benoetigten Teile von chessops (GPL-3.0) als globales Objekt CO.
import { Chess, normalizeMove, castlingSide } from 'chessops/chess';
import { parseFen, makeFen, makeBoardFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { parseUci, makeUci, parseSquare, makeSquare, squareFile, squareRank, opposite } from 'chessops';
import { makePgn, defaultGame, ChildNode } from 'chessops/pgn';
window.CO = { Chess, normalizeMove, castlingSide, parseFen, makeFen, makeBoardFen, makeSan, parseUci, makeUci, parseSquare, makeSquare, squareFile, squareRank, opposite, makePgn, defaultGame, ChildNode };
