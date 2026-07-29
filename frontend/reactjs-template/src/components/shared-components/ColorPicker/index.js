import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types'
import { SketchPicker } from 'react-color';
import { Popover } from 'antd'

const ColorPicker = props => {

	const { colorChange, color='', placement = 'bottomLeft' } = props

	const [visible, setVisible] = useState(false);
	const [pickerColor, setPickerColor] = useState(color)
	const [boxColor, setBoxColor] = useState(color)

	useEffect(() => {
		setBoxColor(color);
		setPickerColor(color)
	}, [color]);

	const onColorChange = (value) => {
		const {rgb} = value
		const rgba = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`
		setBoxColor(rgba)
		setPickerColor(rgb)
		colorChange(value)
	}

	return (
		<div className="color-picker">
			<Popover
				content={<SketchPicker color={pickerColor} onChange={onColorChange}/>}
				trigger="click"
				visible={visible}
				onVisibleChange={setVisible}
				placement={placement}
				getPopupContainer={() => document.body}
				overlayClassName="color-picker-popover"
				overlayStyle={{ maxWidth: 'calc(100vw - 16px)' }}
				destroyTooltipOnHide
			>
				<div className="color-picker-dropdown">
					<div className="color" style={{backgroundColor: boxColor ? boxColor : '#ffffff'}} />
				</div>
			</Popover>
		</div>
	)
}

ColorPicker.propTypes = {
	color: PropTypes.string,
	colorChange: PropTypes.func,
	placement: PropTypes.oneOf(['bottomLeft', 'bottomRight'])
}


export default ColorPicker;
