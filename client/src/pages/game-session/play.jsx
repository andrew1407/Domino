import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getJoinedPlayers, getRoundInfo, getSessionId } from '../../storage/selectors';
import { setCurrentPlayer } from '../../storage/actions/currentPlayer';
import { setCurrentMove, setRoundInfo } from '../../storage/actions/roundInfo';
import { clearPickedTile } from '../../storage/actions/pickedTile';
import { setPlayerDeck } from '../../storage/actions/playerDeck';
import { setCommonDeck } from '../../storage/actions/commonDeck';
import { addJoinedPlayer, removeJoinedPlayer, setJoinedPlayers, updateScores } from '../../storage/actions/joinedPlayers';
import { addToLog } from '../../storage/actions/log';
import { setWaitForPlayers } from '../../storage/actions/waitForPlayers';
import { setSessionId } from '../../storage/actions/sessionId';
import { setFirstTile } from '../../storage/actions/firstTile';
import { setSessionEmitter } from '../../storage/actions/sessionEmitter';
import { resetState, setSessionStatus } from '../../storage/actions/sessionStatus';
import { socketConnection } from '../../api/ws/socketConnection';
import { setSessionServer } from '../../config/server';
import GameSession from '../../components/gameSession/GameSession';
import RoundResultModal from '../../components/modals/RoundResultModal';
import ErrorMessageModal from '../../components/modals/ErrorMessageModal';

const makeStateHandlers = dispatch => ({
  setCurrentPlayer: (...args) => dispatch(setCurrentPlayer(...args)),
  setRoundInfo: (...args) => dispatch(setRoundInfo(...args)),
  setJoinedPlayers: (...args) => dispatch(setJoinedPlayers(...args)),
  removeJoinedPlayer: (...args) => dispatch(removeJoinedPlayer(...args)),
  addJoinedPlayer: (...args) => dispatch(addJoinedPlayer(...args)),
  updateScores: (...args) => dispatch(updateScores(...args)),
  addToLog: (...args) => dispatch(addToLog(...args)),
  setPlayerDeck: (...args) => dispatch(setPlayerDeck(...args)),
  setCommonDeck: (...args) => dispatch(setCommonDeck(...args)),
  setCurrentMove: (...args) => dispatch(setCurrentMove(...args)),
  setFirstTile: (...args) => dispatch(setFirstTile(...args)),
  clearPickedTile: (...args) => dispatch(clearPickedTile(...args)),
  setSessionStatus: (...args) => dispatch(setSessionStatus(...args)),
  setConnectionClosed: closed => dispatch(setSessionStatus({ connectionClosed: closed })),
});

export default function GameSessionPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const sessionId = useSelector(getSessionId);
  const roundInfo = useSelector(getRoundInfo);
  const joinedPlayers = useSelector(getJoinedPlayers);
  const [ errorMessage, setErrorMessage ] = useState('');
  const closeModal = useCallback(() => setErrorMessage(''), []);
  const queryId = router.isReady ? router.query.id : undefined;

  useEffect(() => {
    if (!router.isReady) return;
    if (!queryId) router.replace('/game-session');
  }, [router.isReady, queryId]);

  useEffect(() => {
    if (!queryId) return;
    // invite links carry the server address of the session: it is used for
    // this session only and does not replace the visitor's own settings
    const { http, ws } = router.query;
    if (typeof http === 'string' && typeof ws === 'string')
      setSessionServer({ httpAddr: http, wsAddr: ws });
    dispatch(resetState());
    dispatch(setSessionId(queryId));
    const handlers = makeStateHandlers(dispatch);
    handlers.setErrorMessage = setErrorMessage;
    const emitter = socketConnection(queryId, handlers);
    dispatch(setSessionEmitter(emitter));
    return () => {
      setSessionServer(null);
      emitter.close();
      dispatch(resetState());
    };
  }, [queryId]);

  useEffect(() => {
    const total = roundInfo.players;
    const joined = joinedPlayers.length;
    dispatch(setWaitForPlayers(!(total && total === joined)));
  }, [roundInfo.players, joinedPlayers.length]);

  return (
    <>
      <Head>
        <title>{sessionId ? 'Domino: game session' : 'Domino'}</title>
      </Head>

      <GameSession />

      <RoundResultModal />

      <ErrorMessageModal
        visible={!!errorMessage}
        message={errorMessage}
        onClick={closeModal}
      />
    </>
  );
}
