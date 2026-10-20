import { cloneElement, useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";

const Wrapper = styled.span`
  position: relative;
  display: inline-flex;
`;

const TooltipBox = styled.span`
  position: absolute;
  z-index: 50;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 9px;
  border-radius: 5px;
  background: #25282c;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  pointer-events: none;
`;

export default function IconTooltip({ label, children, delay = 450 }) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();
  const timeoutRef = useRef(null);
  const child = cloneElement(children, {
    "aria-describedby": visible
      ? [children.props["aria-describedby"], tooltipId].filter(Boolean).join(" ")
      : children.props["aria-describedby"],
  });

  function cancelPending() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function showAfterDelay() {
    cancelPending();
    timeoutRef.current = window.setTimeout(() => {
      setVisible(true);
      timeoutRef.current = null;
    }, delay);
  }

  function hide() {
    cancelPending();
    setVisible(false);
  }

  function showForTouch() {
    cancelPending();
    setVisible(true);
    timeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      timeoutRef.current = null;
    }, 1600);
  }

  useEffect(() => () => cancelPending(), []);

  return (
    <Wrapper
      onMouseEnter={showAfterDelay}
      onMouseLeave={hide}
      onFocus={showAfterDelay}
      onBlur={hide}
      onTouchStart={showForTouch}
    >
      {child}
      {visible && <TooltipBox id={tooltipId} role="tooltip">{label}</TooltipBox>}
    </Wrapper>
  );
}
