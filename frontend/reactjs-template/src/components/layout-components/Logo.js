import React from 'react'
import { SIDE_NAV_WIDTH, SIDE_NAV_COLLAPSED_WIDTH, NAV_TYPE_TOP } from 'constants/ThemeConstant';
import { APP_NAME } from 'configs/AppConfig';
import { connect } from "react-redux";
import utils from 'utils';
import { Grid } from 'antd';

const { useBreakpoint } = Grid;

const getLogoWidthGutter = (props, isMobile) => {
  const { navCollapsed, navType } = props;
  const isNavTop = navType === NAV_TYPE_TOP ? true : false
  if(isMobile && !props.mobileLogo) {
    return 0
  }
  if(isNavTop) {
    return 'auto'
  }
  if(navCollapsed) {
    return `${SIDE_NAV_COLLAPSED_WIDTH}px`
  } else {
    return `${SIDE_NAV_WIDTH}px`
  }
}

const getLogoDisplay = (isMobile, mobileLogo) => {
  if(isMobile && !mobileLogo) {
    return 'd-none'
  } else {
    return 'logo'
  }
}

export const Logo = (props) => {
  const isMobile = !utils.getBreakPoint(useBreakpoint()).includes('lg')
  return (
    <div
      className={getLogoDisplay(isMobile, props.mobileLogo)} 
      style={{width: `${getLogoWidthGutter(props, isMobile)}`}}>
      <span className="logo-brand" aria-label={`${APP_NAME} logo`}>
        {props.navCollapsed ? 'EM' : APP_NAME}
      </span>
    </div>
  )
}

const mapStateToProps = ({ theme }) => {
  const { navCollapsed, navType } =  theme;
  return { navCollapsed, navType }
};

export default connect(mapStateToProps)(Logo);
