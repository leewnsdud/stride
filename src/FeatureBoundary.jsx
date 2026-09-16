import React, { Component, Suspense } from "react";

// Keep a failed optional feature from removing the record or its modal controls.
export default class FeatureBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    const { label, children } = this.props;
    if (this.state.failed) {
      return (
        <section className="analysis-section" role="alert">
          <p>{label} 화면을 불러오지 못했습니다.</p>
          <p className="helper">연결을 확인하고 화면을 새로고침해 주세요.</p>
          <button className="button" onClick={() => window.location.reload()}>
            화면 새로고침
          </button>
        </section>
      );
    }
    return (
      <Suspense
        fallback={
          <p className="helper" role="status">
            {label} 화면을 불러오는 중…
          </p>
        }
      >
        {children}
      </Suspense>
    );
  }
}
