import { Link } from "react-router-dom";
import { ChevronRight, History } from "lucide-react";
import { Topbar } from "../../app/Shell";
import { useStore } from "../../app/store";
import { SimTag, Tag, formatTime } from "../../components/ui";

export function RecordsPage() {
  const { data } = useStore();
  const rows = data.activities
    .flatMap((a) => a.sessions.map((s) => ({ a, s, child: data.children.find((c) => c.id === a.childId) })))
    .sort((x, y) => y.s.createdAt.localeCompare(x.s.createdAt));
  const versions = data.activities.flatMap((a) => a.versions.map((v) => ({ a, v }))).sort((x, y) => y.v.approvedAt.localeCompare(x.v.approvedAt));

  return (
    <>
      <Topbar>
        <div className="crumbs">
          <strong>教学记录</strong>
        </div>
      </Topbar>
      <div className="page">
        <div className="page-head">
          <div className="grow">
            <h1>教学记录</h1>
            <p>每次课堂都关联当时批准的教案版本。之后修订教案不会改变这里的历史。</p>
          </div>
        </div>
        <section style={{ marginBottom: 32 }}>
          <div className="section-title">
            <h2>课堂记录</h2>
            <SimTag>模拟课堂</SimTag>
          </div>
          {rows.length === 0 ? (
            <div className="panel empty">
              <History className="ico" />
              <h3>还没有课堂记录</h3>
              <p>教案批准并完成模拟传输后，可在活动的“课堂与复盘”中生成模拟课堂记录。</p>
            </div>
          ) : (
            <div className="panel table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>课堂时间</th>
                    <th>活动</th>
                    <th>儿童</th>
                    <th>教案版本</th>
                    <th>事件</th>
                    <th>复盘</th>
                    <th aria-label="操作" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ a, s, child }) => (
                    <tr key={s.id}>
                      <td className="num">{formatTime(s.createdAt)}</td>
                      <td>{a.title}</td>
                      <td>{child?.name}</td>
                      <td>
                        <Tag tone="primary">v{s.versionNo}</Tag>
                      </td>
                      <td className="num">{s.events.length} 条</td>
                      <td>
                        {s.reflection?.status === "reviewed" ? (
                          <Tag tone="ok">已审核</Tag>
                        ) : s.reflection ? (
                          <Tag tone="warn">草稿待审核</Tag>
                        ) : (
                          <Tag>未开始</Tag>
                        )}
                      </td>
                      <td className="right">
                        <Link to={`/activities/${a.id}/class?session=${s.id}`} className="btn btn-quiet btn-sm">
                          <span className="btn-label">打开</span>
                          <ChevronRight className="ico" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section>
          <div className="section-title">
            <h2>已批准的教案版本</h2>
          </div>
          {versions.length === 0 ? (
            <p className="small muted">暂无批准版本。</p>
          ) : (
            <div className="panel table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>批准时间</th>
                    <th>活动</th>
                    <th>版本</th>
                    <th>校验码</th>
                    <th>传输</th>
                    <th aria-label="操作" />
                  </tr>
                </thead>
                <tbody>
                  {versions.map(({ a, v }) => {
                    const ok = a.transfers.some((t) => t.versionId === v.id && t.ok);
                    return (
                      <tr key={v.id}>
                        <td className="num">{formatTime(v.approvedAt)}</td>
                        <td>{a.title}</td>
                        <td>
                          <Tag tone="primary">v{v.versionNo}</Tag>
                        </td>
                        <td className="mono">{v.checksum}</td>
                        <td>{ok ? <Tag tone="ok">已传输（模拟）</Tag> : <Tag>未传输</Tag>}</td>
                        <td className="right">
                          <Link to={`/activities/${a.id}/review?version=${v.id}`} className="btn btn-quiet btn-sm">
                            <span className="btn-label">查看</span>
                            <ChevronRight className="ico" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
