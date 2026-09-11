import { useRef, useState } from "react";

// Permite clicar em uma área vazia do container (fundo do quadro, entre
// colunas) e arrastar com o mouse para rolar horizontalmente — em vez de
// precisar usar a barra de scroll embaixo da tela.
//
// Ignora cliques que começam em cima de um card (data-rbd-draggable-id,
// atributo que o @hello-pangea/dnd já injeta em todo Draggable) ou de
// controles interativos (botão, input, link), para não conflitar com o
// drag-and-drop dos cards nem com cliques normais.
export default function useDragScroll() {
  const ref = useRef(null);
  const arrastando = useRef(false);
  const posInicial = useRef({ x: 0, scrollLeft: 0 });
  const [emArrasto, setEmArrasto] = useState(false);

  function iniciar(e) {
    if (
      e.target.closest(
        '[data-rbd-draggable-id], button, input, textarea, select, a, [role="button"]'
      )
    ) {
      return;
    }
    const el = ref.current;
    if (!el) return;

    arrastando.current = true;
    posInicial.current = { x: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    setEmArrasto(true);
  }

  function parar() {
    if (!arrastando.current) return;
    arrastando.current = false;
    setEmArrasto(false);
  }

  function mover(e) {
    if (!arrastando.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const distancia = x - posInicial.current.x;
    ref.current.scrollLeft = posInicial.current.scrollLeft - distancia;
  }

  return {
    ref,
    emArrasto,
    handlers: {
      onMouseDown: iniciar,
      onMouseUp: parar,
      onMouseLeave: parar,
      onMouseMove: mover,
    },
  };
}