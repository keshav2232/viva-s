import React, { useState, useRef } from "react";

export default function SyllabusMindMap({ 
  syllabusStructure, 
  selectedSubtopic, 
  setSelectedSubtopic, 
  practiceMode 
}) {
  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredSubtopic, setHoveredSubtopic] = useState(null);
  const canvasContainerRef = useRef(null);

  const isProfessional = practiceMode === "professional";

  const handleMouseDown = (e) => {
    // Only drag with left click on background or nodes
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    // Prevent default zoom triggers only when inside the container
    e.preventDefault();
    const zoomIntensity = 0.05;
    const delta = e.deltaY < 0 ? zoomIntensity : -zoomIntensity;
    setZoomScale(prev => Math.max(0.4, Math.min(2.0, prev + delta)));
  };

  const getMindMapNodes = () => {
    if (!syllabusStructure) return { nodes: [], links: [], svgHeight: 340 };

    const getNodeWidth = (name, type) => {
      if (type === "subject") {
        return Math.max(135, Math.min(220, name.length * 7.5 + 24));
      } else if (type === "unit") {
        const cleanName = name.replace(/^(unit|competency)\s*\d+\s*:\s*/i, "");
        return Math.max(130, Math.min(200, cleanName.length * 7 + 24));
      } else {
        return Math.max(150, Math.min(300, name.length * 6.5 + 24));
      }
    };

    const getSubtopicHeight = (name, width) => {
      const charsPerLine = Math.floor((width - 16) / 6);
      const lines = Math.ceil(name.length / charsPerLine);
      return Math.max(32, Math.min(52, lines * 16 + 10));
    };

    const nodes = [];
    const links = [];

    // Pre-calculate subtopic layout and dynamic canvas height sequentially
    let currentY = 24; // starting padding
    const subtopicGap = 12; // vertical gap between subtopics
    const unitClusterGap = 32; // vertical gap between unit clusters
    const defaultCardHeight = 32;

    const unitLayouts = [];

    syllabusStructure.units.forEach((u, uIdx) => {
      const topicYs = [];
      const topicHeights = [];
      u.topics.forEach((t, tIdx) => {
        const tWidth = getNodeWidth(t, "subtopic");
        const tHeight = getSubtopicHeight(t, tWidth);
        topicHeights.push(tHeight);
        topicYs.push(currentY + tHeight / 2);
        currentY += tHeight + subtopicGap;
      });

      let calculatedUnitY = currentY - defaultCardHeight / 2;
      if (topicYs.length > 0) {
        calculatedUnitY = (topicYs[0] + topicYs[topicYs.length - 1]) / 2;
      } else {
        topicYs.push(currentY + defaultCardHeight / 2);
        topicHeights.push(defaultCardHeight);
        calculatedUnitY = currentY + defaultCardHeight / 2;
        currentY += defaultCardHeight + subtopicGap;
      }

      unitLayouts.push({
        unitY: calculatedUnitY,
        topicYs: topicYs,
        topicHeights: topicHeights
      });

      currentY = currentY - subtopicGap + unitClusterGap;
    });

    const svgHeight = Math.max(340, currentY - unitClusterGap + 24);

    // 1. Subject Node
    const subjectWidth = getNodeWidth(syllabusStructure.topic, "subject");
    // ponytail: Simple dynamic horizontal layout offset based on subject node width. Ceiling: assumes 3-tier depth layout and single line node titles. Upgrade path: implement D3 force-directed or hierarchal grid layout.
    const subjectX = subjectWidth / 2 + 20;
    const subjectY = svgHeight / 2;

    nodes.push({
      id: "subject",
      type: "subject",
      name: syllabusStructure.topic,
      x: subjectX,
      y: subjectY,
      width: subjectWidth,
      height: 54
    });

    syllabusStructure.units.forEach((u, uIdx) => {
      // 2. Unit Node
      // Scale unitX relative to subject space to avoid overlaps
      const unitX = Math.max(260, subjectX + subjectWidth / 2 + 100);
      const { unitY, topicYs, topicHeights } = unitLayouts[uIdx];
      const unitId = `unit_${uIdx}`;
      const unitWidth = getNodeWidth(u.name, "unit");
      
      nodes.push({
        id: unitId,
        type: "unit",
        name: u.name,
        x: unitX,
        y: unitY,
        unitIndex: uIdx,
        width: unitWidth,
        height: 46
      });

      links.push({
        source: "subject",
        target: unitId,
        type: "unit",
        unitIndex: uIdx,
        x1: subjectX + subjectWidth / 2,
        y1: subjectY,
        x2: unitX - unitWidth / 2,
        y2: unitY
      });

      // 3. Subtopics
      u.topics.forEach((t, tIdx) => {
        const topicWidth = getNodeWidth(t, "subtopic");
        const topicHeight = topicHeights[tIdx] || defaultCardHeight;
        const topicX = unitX + unitWidth / 2 + 20 + topicWidth / 2;
        const topicY = topicYs[tIdx];
        const topicId = `topic_${uIdx}_${tIdx}`;
        
        nodes.push({
          id: topicId,
          type: "subtopic",
          name: t,
          x: topicX,
          y: topicY,
          unitIndex: uIdx,
          topicIndex: tIdx,
          width: topicWidth,
          height: topicHeight
        });

        links.push({
          source: unitId,
          target: topicId,
          type: "subtopic",
          unitIndex: uIdx,
          topicIndex: tIdx,
          x1: unitX + unitWidth / 2,
          y1: unitY,
          x2: topicX - topicWidth / 2,
          y2: topicY
        });
      });
    });

    return { nodes, links, svgHeight };
  };

  const { nodes, links, svgHeight } = getMindMapNodes();

  const handleZoomIn = () => setZoomScale(prev => Math.min(2.0, prev + 0.15));
  const handleZoomOut = () => setZoomScale(prev => Math.max(0.4, prev - 0.15));
  const handleReset = () => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div 
      ref={canvasContainerRef}
      className={`mind-map-canvas-container ${isDragging ? "grabbing" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{
        width: "100%",
        height: "420px",
        overflow: "hidden",
        position: "relative",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--bg-input)",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none"
      }}
    >
      {/* HUD Zoom Controls */}
      <div className="zoom-controls-overlay" style={{ position: "absolute", bottom: "12px", right: "12px", display: "flex", gap: "6px", zIndex: 10 }}>
        <button type="button" className="btn-zoom" onClick={handleZoomIn} title="Zoom In">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button type="button" className="btn-zoom" onClick={handleZoomOut} title="Zoom Out">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button type="button" className="btn-zoom" onClick={handleReset} title="Reset View">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <polyline points="3 3 3 8 8 8"></polyline>
          </svg>
        </button>
      </div>

      <svg 
        width="100%" 
        height="100%" 
        viewBox={`0 0 ${Math.max(780, nodes.reduce((max, n) => Math.max(max, n.x + n.width / 2 + 20), 780))} ${svgHeight}`} 
        style={{ display: "block", margin: "0 auto", maxHeight: `${svgHeight}px` }}
      >
        <defs>
          <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <g 
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
            transformOrigin: `320px ${svgHeight / 2}px`,
            transition: isDragging ? "none" : "transform 0.15s cubic-bezier(0.25, 0.8, 0.25, 1)"
          }}
        >
          {/* CONNECTOR PATHS */}
          {links.map((link, idx) => {
            const isHoveredOrSelected = 
              (hoveredSubtopic && (link.target === hoveredSubtopic || link.source === hoveredSubtopic)) ||
              (selectedSubtopic && (link.target === `topic_${selectedSubtopic.unitIndex}_${selectedSubtopic.topicIndex}` || link.source === `topic_${selectedSubtopic.unitIndex}_${selectedSubtopic.topicIndex}`));
            
            let delay = 0;
            let animateClass = "animate-link-solid";
            
            if (link.type === "unit") {
              delay = link.unitIndex * 80;
              animateClass = "animate-link-solid";
            } else {
              delay = 250 + link.unitIndex * 100 + link.topicIndex * 40;
              animateClass = "animate-link-dashed";
            }

            return (
              <path
                key={`link_${idx}`}
                className={animateClass}
                d={`M ${link.x1} ${link.y1} C ${(link.x1 + link.x2) / 2} ${link.y1}, ${(link.x1 + link.x2) / 2} ${link.y2}, ${link.x2} ${link.y2}`}
                fill="none"
                stroke={isHoveredOrSelected ? "var(--color-warning)" : "var(--border-color)"}
                strokeWidth={isHoveredOrSelected ? "2.5" : "1.25"}
                style={{ 
                  animationDelay: `${delay}ms`,
                  transition: "stroke 0.25s, stroke-width 0.25s" 
                }}
              />
            );
          })}

          {/* NODE PILLS */}
          {nodes.map((node) => {
            const isSelected = selectedSubtopic && node.type === "subtopic" && selectedSubtopic.unitIndex === node.unitIndex && selectedSubtopic.topicIndex === node.topicIndex;
            
            const width = node.width;
            const height = node.height;

            let animationClass = "animate-subject";
            let delay = 0;
            if (node.type === "subject") {
              animationClass = "animate-subject";
              delay = 0;
            } else if (node.type === "unit") {
              animationClass = "animate-unit";
              delay = node.unitIndex * 60;
            } else if (node.type === "subtopic") {
              animationClass = "animate-subtopic";
              delay = 200 + node.unitIndex * 80 + node.topicIndex * 30;
            }

            return (
              <g
                key={node.id}
                className={animationClass}
                style={{
                  animationDelay: `${delay}ms`,
                  transform: `translate(${node.x}px, ${node.y}px)`
                }}
              >
                {node.type === "subtopic" ? (
                  <g
                    className="mindmap-subtopic-node"
                    onMouseEnter={() => setHoveredSubtopic(node.id)}
                    onMouseLeave={() => setHoveredSubtopic(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSelected) {
                        setSelectedSubtopic(null); // Deselect if selected
                      } else {
                        setSelectedSubtopic({
                          name: node.name,
                          unitIndex: node.unitIndex,
                          topicIndex: node.topicIndex
                        });
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Node Capsule */}
                    <rect
                      x={-width / 2}
                      y={-height / 2}
                      width={width}
                      height={height}
                      rx="16"
                      ry="16"
                      fill={isSelected ? "var(--color-warning-bg)" : "var(--bg-primary)"}
                      stroke={isSelected ? "var(--color-warning)" : "var(--border-color)"}
                      strokeWidth={isSelected ? 2 : 1.25}
                      filter={isSelected ? "url(#gold-glow)" : "none"}
                      style={{
                        transition: "fill 0.2s, stroke 0.2s, filter 0.2s"
                      }}
                    />
                    {/* Node Content */}
                    <foreignObject
                      x={-width / 2 + 8}
                      y={-height / 2 + 4}
                      width={width - 16}
                      height={height - 8}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.72rem",
                          fontWeight: isSelected ? "700" : "500",
                          color: isSelected ? "var(--color-warning-text)" : "var(--text-primary)",
                          textAlign: "center",
                          lineHeight: "1.25",
                          wordBreak: "break-word",
                          overflow: "hidden"
                        }}
                      >
                        {node.name}
                      </div>
                    </foreignObject>
                  </g>
                ) : (
                  <g>
                    {/* Subject or Unit Node */}
                    <rect
                      x={-width / 2}
                      y={-height / 2}
                      width={width}
                      height={height}
                      rx={node.type === "subject" ? "20" : "8"}
                      ry={node.type === "subject" ? "20" : "8"}
                      fill={node.type === "subject" ? "rgba(99, 102, 241, 0.06)" : "var(--accent-light)"}
                      stroke={node.type === "subject" ? "var(--accent-primary)" : "var(--border-color)"}
                      strokeWidth={node.type === "subject" ? 2.5 : 1.5}
                    />
                    <foreignObject
                      x={-width / 2 + 10}
                      y={-height / 2 + 4}
                      width={width - 20}
                      height={height - 8}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: node.type === "subject" ? "0.82rem" : "0.72rem",
                          fontWeight: "800",
                          color: node.type === "subject" ? "var(--accent-primary)" : "var(--text-primary)",
                          textAlign: "center",
                          lineHeight: "1.3",
                          wordBreak: "break-word",
                          overflow: "hidden"
                        }}
                      >
                        {node.type === "unit" && (
                          <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", display: "block", marginBottom: "1px" }}>
                            {isProfessional ? `Competency ${node.unitIndex + 1}` : `Unit ${node.unitIndex + 1}`}
                          </span>
                        )}
                        <span>
                          {node.type === "unit" ? node.name.replace(/^(unit|competency)\s*\d+\s*:\s*/i, "") : node.name}
                        </span>
                      </div>
                    </foreignObject>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
